import {
  FrameActionBody,
  Message,
  NobleEd25519Signer,
  makeFrameAction,
} from '@farcaster/core'
import { bytesToHex } from '@noble/curves/abstract/utils'
import { ed25519 } from '@noble/curves/ed25519'
import { Hono } from 'hono'
import { ImageResponse } from 'hono-og'
import { jsxRenderer } from 'hono/jsx-renderer'
import { type Env, type Schema } from 'hono/types'

import { Preview, previewStyles } from './preview/components.js'
import { htmlToFrame, htmlToState } from './preview/utils.js'
import {
  type FrameContext,
  type FrameImageAspectRatio,
  type FrameIntents,
  type PreviousFrameContext,
} from './types.js'
import { deserializeJson } from './utils/deserializeJson.js'
import { getFrameContext } from './utils/getFrameContext.js'
import { parseIntents } from './utils/parseIntents.js'
import { serializeJson } from './utils/serializeJson.js'
import { toBaseUrl } from './utils/toBaseUrl.js'

export type FrameHandlerReturnType = {
  image: JSX.Element
  imageAspectRatio?: FrameImageAspectRatio | undefined
  intents?: FrameIntents | undefined
}

export class Farc<
  E extends Env = Env,
  S extends Schema = {},
  BasePath extends string = '/',
> extends Hono<E, S, BasePath> {
  frame<P extends string>(
    path: P,
    handler: (
      context: FrameContext<P>,
      previousContext?: PreviousFrameContext | undefined,
    ) => FrameHandlerReturnType | Promise<FrameHandlerReturnType>,
  ) {
    // Frame Route (implements GET & POST).
    this.use(path, async (c) => {
      const query = c.req.query()
      const previousContext = query.previousContext
        ? deserializeJson<PreviousFrameContext>(query.previousContext)
        : undefined
      const context = await getFrameContext(c, previousContext)

      const { imageAspectRatio, intents } = await handler(
        context,
        previousContext,
      )
      const parsedIntents = intents ? parseIntents(intents) : null

      const serializedContext = serializeJson(context)
      const serializedPreviousContext = serializeJson({
        ...context,
        intents: parsedIntents,
      })

      const ogSearch = new URLSearchParams()
      if (query.previousContext)
        ogSearch.set('previousContext', query.previousContext)
      if (serializedContext) ogSearch.set('context', serializedContext)

      const postSearch = new URLSearchParams()
      if (serializedPreviousContext)
        postSearch.set('previousContext', serializedPreviousContext)

      return c.render(
        <html lang="en">
          <head>
            <meta property="fc:frame" content="vNext" />
            <meta
              property="fc:frame:image"
              content={`${toBaseUrl(context.url)}/image?${ogSearch.toString()}`}
            />
            <meta
              property="fc:frame:image:aspect_ratio"
              content={imageAspectRatio ?? '1.91:1'}
            />
            <meta
              property="og:image"
              content={`${toBaseUrl(context.url)}/image?${ogSearch.toString()}`}
            />
            <meta
              property="fc:frame:post_url"
              content={`${toBaseUrl(context.url)}?${postSearch}`}
            />
            {parsedIntents}

            <meta property="farc:context" content={serializedContext} />
            {query.previousContext && (
              <meta
                property="farc:prev_context"
                content={query.previousContext}
              />
            )}
          </head>
        </html>,
      )
    })

    // OG Image Route
    this.get(`${toBaseUrl(path)}/image`, async (c) => {
      const query = c.req.query()
      const parsedContext = deserializeJson<FrameContext>(query.context)
      const parsedPreviousContext = query.previousContext
        ? deserializeJson<PreviousFrameContext>(query.previousContext)
        : undefined
      const { image } = await handler(
        { ...parsedContext, request: c.req },
        parsedPreviousContext,
      )
      return new ImageResponse(image)
    })

    // Frame Preview Routes
    this.use(
      `${toBaseUrl(path)}/preview`,
      jsxRenderer(
        (props) => {
          const { children } = props
          return (
            <html lang="en">
              <head>
                <title>𝑭𝒂𝒓𝒄 ▶︎ {path}</title>
                <style>{previewStyles()}</style>
              </head>
              <body style={{ padding: '1rem' }}>{children}</body>
            </html>
          )
        },
        { docType: true },
      ),
    )
      .get(async (c) => {
        const baseUrl = c.req.url.replace('/preview', '')
        const response = await fetch(baseUrl)
        const text = await response.text()
        const frame = htmlToFrame(text)
        const state = htmlToState(text)
        return c.render(<Preview {...{ baseUrl, frame, state }} />)
      })
      .post(async (c) => {
        const baseUrl = c.req.url.replace('/preview', '')

        const formData = await c.req.formData()
        const buttonIndex = parseInt(
          typeof formData.get('buttonIndex') === 'string'
            ? (formData.get('buttonIndex') as string)
            : '',
        )
        // TODO: Sanitize input
        const inputText = formData.get('inputText')
          ? Buffer.from(formData.get('inputText') as string)
          : undefined

        const privateKeyBytes = ed25519.utils.randomPrivateKey()
        // const publicKeyBytes = await ed.getPublicKeyAsync(privateKeyBytes)

        // const key = bytesToHex(publicKeyBytes)
        // const deadline = Math.floor(Date.now() / 1000) + 60 * 60 // now + hour
        //
        // const account = privateKeyToAccount(bytesToHex(privateKeyBytes))
        // const requestFid = 1

        // const signature = await account.signTypedData({
        //   domain: {
        //     name: 'Farcaster SignedKeyRequestValidator',
        //     version: '1',
        //     chainId: 10,
        //     verifyingContract: '0x00000000FC700472606ED4fA22623Acf62c60553',
        //   },
        //   types: {
        //     SignedKeyRequest: [
        //       { name: 'requestFid', type: 'uint256' },
        //       { name: 'key', type: 'bytes' },
        //       { name: 'deadline', type: 'uint256' },
        //     ],
        //   },
        //   primaryType: 'SignedKeyRequest',
        //   message: {
        //     requestFid: BigInt(requestFid),
        //     key,
        //     deadline: BigInt(deadline),
        //   },
        // })

        // const response = await fetch(
        //   'https://api.warpcast.com/v2/signed-key-requests',
        //   {
        //     method: 'POST',
        //     headers: {
        //       'Content-Type': 'application/json',
        //     },
        //     body: JSON.stringify({
        //       deadline,
        //       key,
        //       requestFid,
        //       signature,
        //     }),
        //   },
        // )

        const fid = 2
        const castId = {
          fid,
          hash: new Uint8Array(
            Buffer.from('0000000000000000000000000000000000000000', 'hex'),
          ),
        }
        const frameActionBody = FrameActionBody.create({
          url: Buffer.from(baseUrl),
          buttonIndex,
          castId,
          inputText,
        })
        const frameActionMessage = await makeFrameAction(
          frameActionBody,
          { fid, network: 1 },
          new NobleEd25519Signer(privateKeyBytes),
        )

        const message = frameActionMessage._unsafeUnwrap()
        const response = await fetch(formData.get('action') as string, {
          method: 'POST',
          body: JSON.stringify({
            untrustedData: {
              buttonIndex,
              castId: {
                fid: castId.fid,
                hash: `0x${bytesToHex(castId.hash)}`,
              },
              fid,
              inputText: inputText
                ? Buffer.from(inputText).toString('utf-8')
                : undefined,
              messageHash: `0x${bytesToHex(message.hash)}`,
              network: 1,
              timestamp: message.data.timestamp,
              url: baseUrl,
            },
            trustedData: {
              messageBytes: Buffer.from(
                Message.encode(message).finish(),
              ).toString('hex'),
            },
          }),
        })
        const text = await response.text()
        // TODO: handle redirects
        const frame = htmlToFrame(text)
        const state = htmlToState(text)

        return c.render(<Preview {...{ baseUrl, frame, state }} />)
      })
  }
}
