/** Own the destination independently of React's layout-effect commit order. */
export function createHeroTargetTracker<T>() {
  let owner: { id: string; direction: 'open' | 'close' } | null = null
  let target: T | null = null
  const owns = (id: string, direction: 'open' | 'close') => owner?.id === id && owner.direction === direction
  return {
    begin(id: string, direction: 'open' | 'close') { owner = { id, direction }; target = null },
    landAt(id: string, direction: 'open' | 'close', next: T) {
      if (!owns(id, direction)) return false
      target = next
      return true
    },
    read(id: string, direction: 'open' | 'close') { return owns(id, direction) ? target : null },
  }
}
