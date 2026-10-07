export const layerIds = new WeakMap<object, string>()

export let nextLayerId = 0

export function layerId(object: object) {
  let id = layerIds.get(object)
  if (!id) {
    id = `layer-${++nextLayerId}`
    layerIds.set(object, id)
  }
  return id
}

export function restoreLayerId(object: object, value: unknown) {
  if (typeof value !== 'string' || !/^layer-[0-9]+$/.test(value)) return
  const sequence = Number(value.slice(6))
  if (!Number.isSafeInteger(sequence)) return
  nextLayerId = Math.max(nextLayerId, sequence)
  layerIds.set(object, value)
}
