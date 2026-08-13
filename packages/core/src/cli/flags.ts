export function extractFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  if (index === -1 || index === args.length - 1) return undefined
  return args[index + 1]
}
