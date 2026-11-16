export function anyMissing(anObject: Record<string, any>): boolean {
  // Matches empty string, whitespace-only, '0', 'null', or 'undefined'
  const missingRegex = /^(\s*|0|null|undefined)$/

  return Object.values(anObject).some((val) => missingRegex.test(String(val)))
}

export const capitalize = (str: string) => {
  const spaceUpper = (su: string) => {
    // getting _string so return ' String' with a leading space
    return ` ${su[1]?.toUpperCase()}`
  }
  let s = str[0]?.toUpperCase() + str.slice(1)
  return (
    s
      .replace(/\b[a-z](?=[a-z]{2})/g, (char) => char.toUpperCase())
      // snake_string_format replace _ with space
      .replace(/(_\w)/, spaceUpper)
  )
}


export const sixHash = () => {
  const a = (Math.random() * 46656) | 0
  const b = (Math.random() * 46656) | 0
  return a.toString(36).slice(-3) + b.toString(36).slice(-3)
}

export const vscode =
  // @ts-expect-error
  typeof acquireVsCodeApi !== 'undefined'
    ? // @ts-expect-error
    acquireVsCodeApi()
    : {
      postMessage: (msg: any) => {
        console.log(`[DEV] ${msg.command} in progress...`)
        setTimeout(() => {
          console.log(
            `${msg.command} is done`,
            msg.payload ?? 'with no payload',
          )
        }, 3000)
      },
    }
