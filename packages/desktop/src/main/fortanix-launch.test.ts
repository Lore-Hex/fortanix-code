import { expect, test } from "bun:test"
import { fortanixArguments } from "./fortanix-launch"

test.each([
  [[], ["--standalone"]],
  [
    ["run", "review"],
    ["run", "--standalone", "review"],
  ],
  [
    ["--standalone", "--help"],
    ["--standalone", "--help"],
  ],
])("owns the runtime for %j", (args, expected) => expect(fortanixArguments(args)).toEqual(expected))

test.each([
  { args: ["--server", "https://other.test"] },
  { args: ["run", "--server=http://localhost"] },
  { args: ["run", "--auto"] },
  { args: ["serve"] },
])("rejects alternate server or approval bypass $args", ({ args }) => expect(() => fortanixArguments(args)).toThrow())
