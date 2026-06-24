import { ChevronDown, ChevronRight, Reply, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "../types/chat";

interface MessageBubbleProps {
	message: ChatMessage;
	index?: number;
	onEdit?: (index: number) => void;
	onImageClick?: (src: string) => void;
	onReply?: (index: number, content: string, role: string, timestamp: Date) => void;
	onToggleSave?: (index: number, role: string, content: string, timestamp: Date, isSaved: boolean) => void;
	isSaved?: boolean;
	onFeedback?: (index: number, rating: "up" | "down") => void;
	feedbackState?: "up" | "down" | null;
}

function extractImagesFromContent(content: string): string[] {
	const images: string[] = [];
	if (content.startsWith("data:image/")) {
		images.push(content);
		return images;
	}
	const mdImgRegex = /!\[.*?\]\(([^)]+)\)/g;
	let match;
	while ((match = mdImgRegex.exec(content)) !== null) {
		const url = match[1];
		if (url.startsWith("data:image/") || /\.(png|jpg|jpeg|gif|svg|webp)(\?.*)?$/i.test(url)) {
			images.push(url);
		}
	}
	const dataUrlRegex = /data:image\/[a-zA-Z]+;base64,[a-zA-Z0-9+/=]+/g;
	while ((match = dataUrlRegex.exec(content)) !== null) {
		if (!images.includes(match[0])) {
			images.push(match[0]);
		}
	}
	return images;
}

function parseThinkingContent(content: string): { thinking: string; response: string } {
	const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
	const thinkingParts: string[] = [];
	const responseParts: string[] = [];
	let lastIndex = 0;
	let match;

	while ((match = thinkRegex.exec(content)) !== null) {
		if (match.index > lastIndex) {
			responseParts.push(content.slice(lastIndex, match.index));
		}
		thinkingParts.push(match[1].trim());
		lastIndex = match.index + match[0].length;
	}

	if (lastIndex < content.length) {
		responseParts.push(content.slice(lastIndex));
	}

	return {
		thinking: thinkingParts.join("\n\n"),
		response: responseParts.join("").trim(),
	};
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
	message,
	index,
	onEdit,
	onImageClick,
	onReply,
	onToggleSave,
	isSaved,
	onFeedback,
	feedbackState,
}) => {
	const isUser = message.role === "user";
	const isSystem = message.role === "system";
	const [thinkOpen, setThinkOpen] = useState(false);
	const { thinking, response: cleanContent } = parseThinkingContent(message.content);
	const displayContent = cleanContent || message.content;

	const images = extractImagesFromContent(message.content);

	if (isSystem) {
		return (
			<div style={{ textAlign: "center", padding: "8px 16px", fontSize: "12px", color: "var(--text-dim)" }}>
				{message.content}
			</div>
		);
	}

	const handleClick = () => {
		if (isUser && onEdit && index !== undefined) {
			onEdit(index);
		}
	};

	const handleReply = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (onReply && index !== undefined) {
			onReply(index, message.content, message.role, message.timestamp);
		}
	};

	const handleFeedback = (rating: "up" | "down") => (e: React.MouseEvent) => {
		e.stopPropagation();
		if (onFeedback && index !== undefined) {
			onFeedback(index, rating);
		}
	};

	const handleToggleSave = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (onToggleSave && index !== undefined) {
			onToggleSave(index, message.role, message.content, message.timestamp, !!isSaved);
		}
	};

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: isUser ? "flex-end" : "flex-start",
				maxWidth: "80%",
				alignSelf: isUser ? "flex-end" : "flex-start",
				cursor: isUser && onEdit ? "pointer" : "default",
			}}
			onClick={handleClick}
		>
			<div
				style={{
					padding: "10px 14px",
					borderRadius: "12px",
					background: isUser ? "linear-gradient(135deg, var(--accent), #7c3aed)" : "rgba(255,255,255,0.05)",
					border: isUser ? "none" : "1px solid var(--border-light)",
					color: isUser ? "white" : "var(--text-main)",
					fontSize: "13px",
					lineHeight: 1.5,
				}}
			>
				{isUser ? (
					<div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
				) : (
					<>
						{thinking && (
							<div
								style={{
									marginBottom: displayContent ? "8px" : 0,
									background: "rgba(52,211,153,0.04)",
									border: "1px solid rgba(52,211,153,0.12)",
									borderRadius: "8px",
									overflow: "hidden",
								}}
							>
								<div
									onClick={() => setThinkOpen(!thinkOpen)}
									style={{
										display: "flex",
										alignItems: "center",
										gap: "6px",
										padding: "6px 10px",
										fontSize: "11px",
										fontWeight: 700,
										color: "#34d399",
										cursor: "pointer",
										userSelect: "none",
									}}
								>
									{thinkOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
									🧠 Razonamiento
								</div>
								{thinkOpen && (
									<div
										style={{
											padding: "0 10px 8px",
											fontSize: "11px",
											lineHeight: 1.6,
											color: "var(--text-dim)",
											whiteSpace: "pre-wrap",
										}}
									>
										{thinking}
									</div>
								)}
							</div>
						)}
						{displayContent ? (
							<Markdown
								remarkPlugins={[remarkGfm]}
								components={{
									code({ className, children, ...props }) {
										const isInline = !className;
										if (isInline) {
											return (
												<code
													style={{
														background: "rgba(255,255,255,0.05)",
														padding: "2px 6px",
														borderRadius: "3px",
														fontSize: "12px",
													}}
													{...props}
												>
													{children}
												</code>
											);
										}
										return (
											<pre
												style={{
													background: "rgba(0,0,0,0.3)",
													padding: "12px",
													borderRadius: "8px",
													overflow: "auto",
													fontSize: "12px",
												}}
											>
												<code {...props}>{children}</code>
											</pre>
										);
									},
									a({ href, children }) {
										return (
											<a
												href={href}
												target="_blank"
												rel="noopener noreferrer"
												style={{ color: "var(--accent)" }}
											>
												{children}
											</a>
										);
									},
								}}
							>
								{displayContent}
							</Markdown>
						) : thinking ? null : (
							message.content
						)}
					</>
				)}
				{images.length > 0 && (
					<div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
						{images.map((src, i) => (
							<img
								key={i}
								src={src}
								alt="Imagen"
								loading="lazy"
								onClick={(e) => {
									e.stopPropagation();
									if (onImageClick) onImageClick(src);
								}}
								style={{
									maxWidth: "100%",
									maxHeight: "300px",
									borderRadius: "8px",
									cursor: onImageClick ? "pointer" : "default",
									objectFit: "contain",
									background: "rgba(0,0,0,0.1)",
								}}
							/>
						))}
					</div>
				)}
			</div>
			<div
				style={{
					fontSize: "10px",
					color: "var(--text-dim)",
					marginTop: "4px",
					padding: "0 4px",
					display: "flex",
					gap: "8px",
					alignItems: "center",
				}}
			>
				<span>{message.timestamp.toLocaleTimeString()}</span>
				{!isUser && message.usage && (
					<span>
						{message.usage.promptTokens} ⇧ / {message.usage.completionTokens} ⇩
					</span>
				)}
				<span style={{ flex: 1 }} />
				{!isUser && !isSystem && (
					<>
						<button
							type="button"
							onClick={handleFeedback("up")}
							title="Respuesta útil"
							style={{
								background: "none",
								border: "none",
								color: feedbackState === "up" ? "var(--success)" : "var(--text-muted)",
								cursor: "pointer",
								padding: "2px",
								display: "flex",
								opacity: feedbackState === "up" ? 1 : 0.6,
							}}
							onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
							onMouseLeave={(e) => { e.currentTarget.style.opacity = feedbackState === "up" ? "1" : "0.6"; }}
						>
							<ThumbsUp size={10} />
						</button>
						<button
							type="button"
							onClick={handleFeedback("down")}
							title="Respuesta incorrecta"
							style={{
								background: "none",
								border: "none",
								color: feedbackState === "down" ? "var(--error)" : "var(--text-muted)",
								cursor: "pointer",
								padding: "2px",
								display: "flex",
								opacity: feedbackState === "down" ? 1 : 0.6,
							}}
							onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
							onMouseLeave={(e) => { e.currentTarget.style.opacity = feedbackState === "down" ? "1" : "0.6"; }}
						>
							<ThumbsDown size={10} />
						</button>
					</>
				)}
				<button
					type="button"
					onClick={handleReply}
					title="Responder"
					style={{
						background: "none",
						border: "none",
						color: "var(--text-muted)",
						cursor: "pointer",
						padding: "2px",
						display: "flex",
						opacity: 0.6,
					}}
					onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
					onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.6"; }}
				>
					<Reply size={10} />
				</button>
				<button
					type="button"
					onClick={handleToggleSave}
					title={isSaved ? "Quitar de guardados" : "Guardar mensaje"}
					style={{
						background: "none",
						border: "none",
						color: isSaved ? "var(--warning)" : "var(--text-muted)",
						cursor: "pointer",
						padding: "2px",
						display: "flex",
						opacity: isSaved ? 1 : 0.6,
					}}
					onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
					onMouseLeave={(e) => { e.currentTarget.style.opacity = isSaved ? "1" : "0.6"; }}
				>
					<Star size={10} fill={isSaved ? "var(--warning)" : "none"} />
				</button>
			</div>
		</div>
	);
};
