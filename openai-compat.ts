import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

interface PiAuthConfig {
  currentProvider?: string;
  providers?: {
    [key: string]: {
      baseUrl?: string;
      apiKey?: string;
      defaultModelId?: string;
    };
  };
}

interface WebSearchConfig {
  openaiCompatBaseUrl?: string;
  openaiCompatApiKey?: string;
  openaiCompatModel?: string;
}

function loadPiAuthConfig(): PiAuthConfig | null {
  try {
    const piDir = join(homedir(), '.pi');
    const authPath = join(piDir, 'agent', 'auth.json');
    
    if (!existsSync(authPath)) {
      return null;
    }
    
    const content = readFileSync(authPath, 'utf-8');
    return JSON.parse(content) as PiAuthConfig;
  } catch (error) {
    return null;
  }
}

function getPiProviderConfig(): { baseUrl?: string; apiKey?: string; defaultModelId?: string } | null {
  const authConfig = loadPiAuthConfig();
  if (!authConfig || !authConfig.currentProvider || !authConfig.providers) {
    return null;
  }
  
  const providerKey = authConfig.currentProvider;
  const providerConfig = authConfig.providers[providerKey];
  
  if (!providerConfig || typeof providerConfig !== 'object') {
    return null;
  }
  
  return {
    baseUrl: providerConfig.baseUrl,
    apiKey: providerConfig.apiKey,
    defaultModelId: providerConfig.defaultModelId
  };
}

function loadWebSearchConfig(): WebSearchConfig {
  try {
    const piDir = join(homedir(), '.pi');
    const configPath = join(piDir, 'web-search.json');
    
    if (!existsSync(configPath)) {
      return {};
    }
    
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as WebSearchConfig;
  } catch (error) {
    return {};
  }
}

export function isOpenAICompatAvailable(): boolean {
  // First check explicit web-search.json config
  const webSearchConfig = loadWebSearchConfig();
  if (webSearchConfig.openaiCompatBaseUrl && webSearchConfig.openaiCompatApiKey) {
    return true;
  }
  
  // Fallback to Pi's current provider
  const piProvider = getPiProviderConfig();
  return !!(piProvider?.baseUrl && piProvider?.apiKey);
}

export async function openaiCompatSearch(
  query: string,
  options: { numResults?: number } = {}
): Promise<{
  results: Array<{
    title: string;
    url: string;
    content: string;
  }>;
  query: string;
} | null> {
  // Load explicit config first
  const webSearchConfig = loadWebSearchConfig();
  
  let baseUrl = webSearchConfig.openaiCompatBaseUrl;
  let apiKey = webSearchConfig.openaiCompatApiKey;
  let model = webSearchConfig.openaiCompatModel;
  
  // Fallback to Pi's current provider if not explicitly configured
  if (!baseUrl || !apiKey) {
    const piProvider = getPiProviderConfig();
    if (piProvider) {
      baseUrl = baseUrl || piProvider.baseUrl;
      apiKey = apiKey || piProvider.apiKey;
      model = model || piProvider.defaultModelId;
    }
  }
  
  if (!baseUrl || !apiKey) {
    return null;
  }
  
  model = model || 'gpt-3.5-turbo';
  
  try {
    const url = `${baseUrl}/chat/completions`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a search assistant. Provide relevant information based on the query.'
          },
          {
            role: 'user',
            content: query
          }
        ],
        tool_choice: 'none',
        temperature: 0.7
      })
    });
    
    if (!response.ok) {
      console.error(`OpenAI-compatible search failed: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      return null;
    }
    
    return {
      results: [
        {
          title: 'OpenAI-Compatible Search Result',
          url: baseUrl,
          content
        }
      ],
      query
    };
  } catch (error) {
    console.error('OpenAI-compatible search error:', error);
    return null;
  }
}
