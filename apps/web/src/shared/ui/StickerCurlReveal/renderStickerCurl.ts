import { palette } from '@sticker-studio/theme'
import { motionTokens } from '@/shared/lib/motion'
import { getStickerUnfold, type StickerRevealPlacement } from './stickerUnfold'
import vertexSource from './stickerUnfoldVertex.glsl?raw'
import fragmentSource from './stickerPageCurl.glsl?raw'

// A continuous mesh keeps the front and white reverse joined at the fold.
export function renderStickerCurl(surface: HTMLCanvasElement, source: HTMLCanvasElement, complete: () => void,
  placement: StickerRevealPlacement = { left: 0, top: 0, width: 1024, height: 1024 }, artworkSource?: HTMLCanvasElement) {
  const gl = surface.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true })
  if (!gl) { complete(); return () => {} }
  let frame = 0
  let disposed = false
  let finished = false
  const shaders: WebGLShader[] = []
  let program: WebGLProgram | null = null
  let buffer: WebGLBuffer | null = null
  let texture: WebGLTexture | null = null
  let artworkTexture: WebGLTexture | null = null
  const finish = () => { if (!disposed && !finished) { finished = true; complete() } }
  const lost = (event: Event) => { event.preventDefault(); finish() }
  const cleanup = () => {
    if (disposed) return
    disposed = true
    cancelAnimationFrame(frame)
    surface.removeEventListener('webglcontextlost', lost)
    gl.deleteTexture(texture)
    gl.deleteTexture(artworkTexture)
    gl.deleteBuffer(buffer)
    gl.deleteProgram(program)
    shaders.forEach(shader => gl.deleteShader(shader))
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
  surface.addEventListener('webglcontextlost', lost)
  try {
    surface.width = 1024
    surface.height = 1024
    gl.viewport(0, 0, surface.width, surface.height)
    const compile = (type: number, code: string) => {
      const shader = gl.createShader(type)
      if (!shader) throw new Error('Could not allocate a sticker shader.')
      shaders.push(shader)
      gl.shaderSource(shader, code)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Could not compile the sticker shader.')
      return shader
    }
    program = gl.createProgram()
    if (!program) throw new Error('Could not allocate the sticker program.')
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource))
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Could not link the sticker program.')
    gl.useProgram(program)
    buffer = gl.createBuffer()
    texture = gl.createTexture()
    if (!buffer || !texture) throw new Error('Could not allocate the sticker surface.')
    const vertices: number[] = []
    const divisions = 100
    for (let y = 0; y < divisions; y++) for (let x = 0; x < divisions; x++) {
      const left = x / divisions, right = (x + 1) / divisions
      const bottom = y / divisions, top = (y + 1) / divisions
      vertices.push(left, bottom, right, bottom, left, top, left, top, right, bottom, right, top)
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW)
    const uv = gl.getAttribLocation(program, 'uv')
    gl.enableVertexAttribArray(uv)
    gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 0, 0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    gl.uniform1i(gl.getUniformLocation(program, 'artwork'), 0)
    artworkTexture = gl.createTexture()
    if (!artworkTexture) throw new Error('Could not allocate the sticker artwork.')
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, artworkTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, artworkSource ?? source)
    gl.uniform1i(gl.getUniformLocation(program, 'plainArtwork'), 1)
    gl.uniform2f(gl.getUniformLocation(program, 'origin'), placement.left / 1024, 1 - (placement.top + placement.height) / 1024)
    gl.uniform2f(gl.getUniformLocation(program, 'size'), placement.width / 1024, placement.height / 1024)
    const white = [1, 3, 5].map(offset => parseInt(palette.white.slice(offset, offset + 2), 16) / 255)
    gl.uniform3f(gl.getUniformLocation(program, 'backColor'), white[0], white[1], white[2])
    const modeLocation = gl.getUniformLocation(program, 'renderMode')
    const unfoldLocation = gl.getUniformLocation(program, 'unfold')
    const outlineLocation = gl.getUniformLocation(program, 'outlineOpacity')
    const shadowLocation = gl.getUniformLocation(program, 'shadowStrength')
    gl.enable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    const start = performance.now()
    const draw = (now: number) => {
      if (disposed || finished) return
      const progress = Math.min(1, (now - start) / (motionTokens.duration.stickerCurl * 1000))
      const unfold = getStickerUnfold(progress)
      const outline = Math.max(0, Math.min(1, (progress - 0.12) / 0.68))
      gl.uniform1f(outlineLocation, outline * outline * (3 - 2 * outline))
      gl.uniform1f(unfoldLocation, unfold)
      gl.uniform1f(shadowLocation, Math.sin(Math.PI * unfold))
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      // Draw the shadow on the transparent canvas, then the folding sticker.
      gl.depthMask(false)
      gl.uniform1f(modeLocation, 2)
      gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2)
      gl.depthMask(true)
      gl.uniform1f(modeLocation, 0)
      gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2)
      if (progress === 1) finish()
      else frame = requestAnimationFrame(draw)
    }
    draw(start)
  } catch { finish(); cleanup() }
  return cleanup
}
