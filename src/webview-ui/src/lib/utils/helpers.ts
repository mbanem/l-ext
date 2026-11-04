export const handleTryCatch = (err: unknown, info?: string) => {
  const msg = err instanceof Error ? err.message : String(err)
  console.log(info, msg)
}

export function isEmpty<T extends object>(obj: T) {
  return Object.keys(obj).length === 0
}

export function anyMissing(anObject: Record<string, any>): boolean {
  // Matches empty string, whitespace-only, '0', 'null', or 'undefined'
  const missingRegex = /^(\s*|0|null|undefined)$/

  return Object.values(anObject).some((val) => missingRegex.test(String(val)))
}
export const sixHash = () => {
  const a = (Math.random() * 46656) | 0
  const b = (Math.random() * 46656) | 0
  return a.toString(36).slice(-3) + b.toString(36).slice(-3)
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
String.prototype.capitalize = function () {
  // TypeScript sada zna da 'capitalize' postoji na String prototipu
  // i zna da 'this' unutar ove funkcije predstavlja string objekat
  return capitalize(this as string)
}
Number.prototype.times = function (callback: (index: number) => void): void {
  // 'this' predstavlja broj nad kojim se metoda poziva
  const count = Number(this)

  for (let i = 0; i < count; i++) {
    callback(i)
  }
}
// created object should have the following properties
const attrNames = [
  '"name": ',
  '"type": ',
  '"isArray": ',
  '"isOptional": ',
  '"attrs": ',
]

// create an object with attrNames with attribute values
export function stringToFieldObject(line: string) {
  if (!line) {
    return null
  }
  // non-boolean attributes must be quotted for JSON
  function w(ix: number, el: string | boolean): string | boolean {
    const q = [0, 1, 4].includes(ix) ? '"' : ''
    if (typeof el === 'string') {
      el = el.replace(/"/g, "'")
    }
    return `\t\t${attrNames[ix % 5]}${q}${el}${q},\n\t`
  }
  const raw = attrArrayOptional(
    line.match(
      /\s*(\w+):?\s*(\w+)(\[\])?(\?)?\s*([@a-zA-Z0-9_():\[\]'", \t]*)?/,
    ),
  ).reduce((acc, el, ix) => {
    return ((acc as string) = (acc as string) + w(ix, el))
  }, '\t{\n\t')
  // return JSON.parse(raw.slice(0,-3)+'\n\t}')
  return JSON.parse((raw as string).slice(0, -3) + '\n\t}')
}

// returning tuple has the following type
export type TupleFieldAttrs = [string, string, boolean, boolean, string]
// returns an array of attribute values as quotted if non-booleans
export function attrArrayOptional(match: string[] | null): TupleFieldAttrs {
  if (!match) {
    return ['', '', false, false, '']
  }
  // match is RegExpMatchArray object; we skip the first item with .slice(1,...)
  // as it holds the whole search string. We return an array of attributes
  return [
    ...match.slice(1, 3),
    match[3] === '[]',
    match[4] === '?',
    match[5],
  ] as TupleFieldAttrs
}
