// [COMPRESSED: removed comments, docstrings, excess whitespace, truncated lines]
import { existsSync, readFileSync } from "node:fs";
import type { SearchOptions, SearchResponse, SearchResult } from "./perplexity.ts";
import { getWebSearchConfigPath } from "./utils.ts";

const CONFIG_PATH = getWebSearchConfigPath();

interface OpenAICompatConfig {
	openaiCompatBaseUrl?: string;
	openaiCompatKey?: string;
	openaiCompatModel?: string;
}

interface OpenAICompatResponse {
	choices?: Array<{
		message?: {
			content?: string;
		};
	}>;
}

function loadConfig(): OpenAICompatConfig {
	if (!existsSync(CONFIG_PATH)) return {};
	try {
		return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as OpenAICompatConfig;
	} catch {
		return {};
	}
}

export async function openaiCompatSearch(
	query: string,
	options: SearchOptions = {},
): Promise<SearchResponse | null> {
	const config = loadConfig();
	const baseUrl = config.openaiCompatBaseUrl;
	const apiKey = config.openaiCompatKey;
	const model = config.openaiCompatModel;

	if (!baseUrl || !apiKey) {
		return null;
	}

	const url = `${baseUrl}/chat/completions`;

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model: model ?? "gpt-3.5-turbo",
				messages: [
					{
						role: "system",
						content: "You are a search assistant. Provide relevant information based on the query.",
					},
					{
						role: "user",
						content: query,
					},
				],
				tool_choice: "none",
				temperature: 0.7,
			}),
		});

		if (!response.ok) {
			console.error(`OpenAI-compatible search failed: ${response.status} ${response.statusText}`);
			return null;
		}

		const data = await response.json() as OpenAICompatResponse;
		const content = data.choices?.[0]?.message?.content;

		if (!content) {
			return null;
		}

		const results: SearchResult[] = [
			{
				title: "OpenAI-Compatible Search Result",
				url: baseUrl,
				content: content,
			},
		];

		return {
			query,
			results,
			provider: "openai_compat",
		};
	} catch (error) {
		console.error("OpenAI-compatible search error:", error);
		return null;
	}
}

export function isOpenAICompatAvailable(): boolean {
	const config = loadConfig();
	return !!(config.openaiCompatBaseUrl && config.openaiCompatKey);
}
