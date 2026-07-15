export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) {
    return null
  }
  return <p className="text-danger mt-1 text-sm">{messages.join(' ')}</p>
}
