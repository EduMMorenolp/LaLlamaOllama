import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

const THEME_KEY = "lallama-theme";

interface ThemeCtx {
	theme: Theme;
	toggle: () => void;
	setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeCtx>({ theme: "dark", toggle: () => {}, setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setThemeState] = useState<Theme>(() => {
		try { return (localStorage.getItem(THEME_KEY) as Theme) || "dark"; } catch { return "dark"; }
	});

	useEffect(() => {
		document.documentElement.setAttribute("data-theme", theme);
		try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
	}, [theme]);

	const toggle = useCallback(() => {
		setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
	}, []);

	const setTheme = useCallback((t: Theme) => {
		setThemeState(t);
	}, []);

	return (
		<ThemeContext.Provider value={{ theme, toggle, setTheme }}>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme(): ThemeCtx {
	return useContext(ThemeContext);
}
