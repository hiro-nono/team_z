import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AI_PROVIDERS,
  AiClient,
  buildPdfResponseRequest,
  DEFAULT_ORCAROUTER_BASE_URL,
  DEFAULT_ORCAROUTER_MODEL,
} from '../ai-client.mjs'
import { NOTICE_SCHEMA, SYSTEM_PROMPT } from '../notice-schema.mjs'

function createFakeClientHarness({ payload = { output_text: '{"ok":true}' }, error = null } = {}) {
  let clientOptions
  let requestBody
  let requestOptions

  const client = new AiClient({
    env: {
      AI_PROVIDER: 'orcarouter',
      AI_API_KEY: 'orca-test-key',
      AI_MODEL: 'openai/gpt-4o-mini',
    },
    clientFactory(options) {
      clientOptions = options
      return {
        responses: {
          create(body, options = {}) {
            requestBody = body
            requestOptions = options
            if (error) {
              return Promise.reject(error)
            }

            return {
              async withResponse() {
                return {
                  data: payload,
                  response: new Response(null, {
                    headers: {
                      'x-orca-resolved-model': 'openai/gpt-4o-mini',
                      'x-orca-router': 'none',
                      'x-request-id': 'request-test-1',
                    },
                  }),
                }
              },
            }
          },
        },
      }
    },
  })

  return {
    client,
    get clientOptions() {
      return clientOptions
    },
    get requestBody() {
      return requestBody
    },
    get requestOptions() {
      return requestOptions
    },
  }
}

test('OrcaRouter is the default provider with an explicit OpenAI model', () => {
  const client = new AiClient({ env: { AI_API_KEY: 'orca-test-key' }, clientFactory: () => ({}) })

  assert.equal(client.provider, AI_PROVIDERS.ORCAROUTER)
  assert.equal(client.baseURL, DEFAULT_ORCAROUTER_BASE_URL)
  assert.equal(client.model, DEFAULT_ORCAROUTER_MODEL)
})

test('OrcaRouter baseURL and Responses request are used without exposing the API key', async () => {
  const harness = createFakeClientHarness()
  const request = buildPdfResponseRequest({
    model: harness.client.model,
    systemPrompt: SYSTEM_PROMPT,
    fileName: 'notice.pdf',
    pdfBytes: Buffer.from('%PDF-test'),
    schema: NOTICE_SCHEMA,
  })

  const result = await harness.client.responsesCreate(request)

  assert.equal(harness.clientOptions.baseURL, DEFAULT_ORCAROUTER_BASE_URL)
  assert.equal(harness.clientOptions.apiKey, 'orca-test-key')
  assert.equal(harness.requestBody.model, 'openai/gpt-4o-mini')
  assert.equal(harness.requestBody.input[1].content[1].type, 'input_file')
  assert.match(harness.requestBody.input[1].content[1].file_data, /^data:application\/pdf;base64,JVBERi10ZXN0$/u)
  assert.deepEqual(harness.requestBody.text.format, {
    type: 'json_schema',
    name: 'school_notice',
    strict: true,
    schema: NOTICE_SCHEMA,
  })
  assert.deepEqual(result.metadata, {
    provider: 'orcarouter',
    requestedModel: 'openai/gpt-4o-mini',
    resolvedModel: 'openai/gpt-4o-mini',
    router: 'none',
    fallbackModel: null,
    fallbackLevel: null,
    requestId: 'request-test-1',
  })
  assert.equal('apiKey' in harness.client.publicConfig, false)
  assert.doesNotMatch(JSON.stringify(harness.client.publicConfig), /orca-test-key/u)
})

test('OpenAI direct mode is selected by environment variables', async () => {
  let options
  const client = new AiClient({
    env: {
      AI_PROVIDER: 'openai',
      AI_BASE_URL: 'https://api.openai.com/v1/responses',
      AI_API_KEY: 'openai-test-key',
      AI_MODEL: 'gpt-4.1-mini',
    },
    clientFactory(receivedOptions) {
      options = receivedOptions
      return { responses: { create: async () => ({ output_text: '{"ok":true}' }) } }
    },
  })

  await client.responsesCreate({ input: 'test' })

  assert.equal(client.provider, AI_PROVIDERS.OPENAI)
  assert.equal(options.baseURL, 'https://api.openai.com/v1')
  assert.equal(options.apiKey, 'openai-test-key')
  assert.equal(client.model, 'gpt-4.1-mini')
})

test('Responses request options preserve the abort signal', async () => {
  const harness = createFakeClientHarness()
  const controller = new AbortController()

  await harness.client.responsesCreate({ input: 'test' }, { signal: controller.signal })

  assert.equal(harness.requestOptions.signal, controller.signal)
})

test('AI upstream errors are mapped without returning the API key', async () => {
  const harness = createFakeClientHarness({
    error: Object.assign(new Error('upstream rejected orca-test-key'), { name: 'APIError', status: 400 }),
  })

  await assert.rejects(
    harness.client.responsesCreate({ input: 'test' }),
    (error) => error.code === 'AI_UPSTREAM_ERROR'
      && error.statusCode === 502
      && !error.message.includes('orca-test-key'),
  )
})

test('missing AI key is reported as a backend configuration error', async () => {
  const client = new AiClient({ env: { AI_PROVIDER: 'orcarouter' }, clientFactory: () => { throw new Error('should not create client') } })

  await assert.rejects(
    client.responsesCreate({ input: 'test' }),
    (error) => error.code === 'AI_NOT_CONFIGURED' && error.statusCode === 503,
  )
})
