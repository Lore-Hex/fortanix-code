export function fortanixArguments(args: string[]) {
  if (args.some((arg) => arg === "--server" || arg.startsWith("--server=") || arg === "--auto"))
    throw new Error("Fortanix Code requires its own server and explicit tool approval")

  const rest = args.filter((arg) => arg !== "--standalone")
  if (rest[0] === "run") return ["run", "--standalone", ...rest.slice(1)]
  if (rest[0] && !rest[0].startsWith("-")) throw new Error("Use the interactive agent or run command")
  return ["--standalone", ...rest]
}
