function normalizeHostedProvider(provider) {
  return provider === 'openrouter' || provider === 'nvidia' ? provider : null
}

async function requestHostedChatInMain(request = {}, fetchImpl = fetch) {
  const provider = normalizeHostedProvider(request.provider)
  const apiKey = typeof request.apiKey === 'string' ? request.apiKey.trim() : ''
  const model = typeof request.model === 'string' ? request.model.trim() : ''
  const baseUrl = typeof request.baseUrl === 'string' ? request.baseUrl.trim() : ''
  const messages = Array.isArray(request.messages) ? request.messages : []
  const label = provider === 'nvidia' ? 'NVIDIA hosted' : 'OpenRouter'

  if (!provider) {
    return { ok: false, text: '', error: 'Hosted AI provider is not supported.' }
  }

  if (!apiKey) {
    return { ok: false, text: '', error: `${label} API key is required.` }
  }

  if (!model) {
    return { ok: false, text: '', error: `${label} model is required.` }
  }

  if (!baseUrl) {
    return { ok: false, text: '', error: `${label} base URL is required.` }
  }

  if (!messages.length) {
    return { ok: false, text: '', error: 'Hosted AI messages are required.' }
  }

  try {
    const response = await fetchImpl(`${baseUrl.replace(/\/+$/g, '')}/chat/completions`, {
      method: 'POST',
      headers: buildHostedHeaders(provider, apiKey),
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 700,
      }),
    })

    if (!response.ok) {
      return { ok: false, text: '', error: `${label} HTTP ${response.status}` }
    }

    const payload = await response.json()
    const text = payload?.choices?.[0]?.message?.content?.trim() ?? ''

    return text ? { ok: true, text } : { ok: false, text: '', error: `${label} returned no text.` }
  } catch (error) {
    return {
      ok: false,
      text: '',
      error: error instanceof Error ? error.message : `${label} request failed.`,
    }
  }
}

function buildHostedHeaders(provider, apiKey) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }

  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://github.com/puneetdixit200/duok'
    headers['X-Title'] = 'KannadaOS'
  }

  return headers
}

module.exports = {
  requestHostedChatInMain,
}
