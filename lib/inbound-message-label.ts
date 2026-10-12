// Meta's webhook sends type: 'unsupported' (error code 131051, "Message type
// unknown") when it can't classify what was sent — in practice this is
// almost always an attempted voice/video call to a number that isn't set up
// for the WhatsApp Calling API, since a call attempt has no message schema
// to map to. The raw "[unsupported]" placeholder reads as a bug to a
// merchant; this gives it a label that explains what actually happened.
export function friendlyInboundBody(messageType: string | null | undefined, body: string): string {
  if (messageType === 'unsupported') return '📞 Tried to call you'
  return body
}
