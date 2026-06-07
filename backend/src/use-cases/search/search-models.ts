import axios from "axios";
import * as cheerio from "cheerio";

export class SearchModelsUseCase {
  async execute(q: string, sort: string) {
    let url = "https://ollama.com/library";
    const params = new URLSearchParams();
    if (q) params.append("q", q);
    if (sort) params.append("sort", sort);
    const qs = params.toString();
    if (qs) url += `?${qs}`;

    const response = await axios.get(url, {
      timeout: 8000,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LaLlamaOllama/1.0)" },
    });

    const $ = cheerio.load(response.data);

    interface ScrapedModel {
      name: string;
      title: string;
      desc: string;
      pulls: string;
      tags: string[];
    }

    const models: ScrapedModel[] = [];

    $('a[href^="/library/"]').each((_, el) => {
      const href = $(el).attr("href") || "";
      const name = href.replace("/library/", "").trim();
      if (!name || name.includes("/")) return;

      const title = $(el).find("h2, [class*='title'], strong").first().text().trim() || name;
      const desc = $(el).find("p, [class*='desc']").first().text().trim();
      const pulls = $(el).find("[class*='pull'],[class*='download']").first().text().trim();
      const tags = $(el)
        .find("[class*='tag'],[class*='size']")
        .map((_, t) => $(t).text().trim())
        .get()
        .filter(Boolean)
        .slice(0, 4);

      if (name && !models.find((m) => m.name === name)) {
        models.push({ name, title, desc, pulls, tags });
      }
    });

    return { models: models.slice(0, 24), query: q, source: url };
  }
}
