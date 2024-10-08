import { bytesToHex, bytesToString } from 'viem'
import type {
  FrameActionBody,
  Message,
} from '../protobufs/generated/message_pb.js'
import type { FrameData } from '../types/frame.js'
import { type VerifyMessageParameters, verifyMessage } from './verifyMessage.js'

export type VerifyFrameParameters = VerifyMessageParameters

export type VerifyFrameReturnType = {
  frameData: FrameData
}

export async function verifyFrame(
  parameters: VerifyFrameParameters,
): Promise<VerifyFrameReturnType> {
  const { message } = await verifyMessage(parameters)
  const frameData = messageToFrameData(message)
  return { frameData }
}

////////////////////////////////////////////////////////////////////
// Utilties

export function messageToFrameData(message: Message): FrameData {
  const frameActionBody = message.data?.body.value as FrameActionBody
  const frameData: FrameData = {
    address: frameActionBody.address
      ? bytesToHex(frameActionBody.address)
      : undefined,
    castId: {
      fid: Number(frameActionBody.castId?.fid),
      hash: bytesToHex(frameActionBody.castId?.hash!),
    },
    fid: Number(message.data?.fid!),
    messageHash: bytesToHex(message.hash),
    network: message.data?.network!,
    timestamp: message.data?.timestamp!,
    url: bytesToString(frameActionBody.url),
    buttonIndex: frameActionBody.buttonIndex as any,
    inputText: bytesToString(frameActionBody.inputText),
    state: bytesToString(frameActionBody.state),
    transactionId: frameActionBody.transactionId
      ? bytesToHex(frameActionBody.transactionId)
      : undefined,
  }

  return frameData
}
