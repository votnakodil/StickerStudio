export function isValidPackName(value: string) {
  const name = value.trim().replace(/\s+/g, ' ')
  return name.length > 0 && value.length <= 64 && /^[A-Za-zА-Яа-яЁё0-9 _-]+$/u.test(name) && /[A-Za-zА-Яа-яЁё0-9]/u.test(name)
}
