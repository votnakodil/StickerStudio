attribute vec2 uv;
uniform vec2 origin;
uniform vec2 size;
uniform float unfold;
uniform mediump float renderMode;
varying vec2 textureCoordinate;
varying float creaseDistance;
varying float lift;
void main() {
  textureCoordinate = uv;
  vec2 point = (uv - 0.5) * size;
  float radius = min(size.x, size.y) * 0.075;
  float crease = mix(-size.y * 0.5 - radius * 0.3, size.y * 0.5 + radius, unfold);
  creaseDistance = (point.y - crease) / radius;
  float height = 0.0;
  if (point.y > crease) {
    float distance = point.y - crease;
    float angle = min(distance / radius, 3.141593);
    point.y = crease + radius * sin(angle) - max(0.0, distance - radius * 3.141593);
    height = radius * (1.0 - cos(angle));
  }
  lift = height / radius;
  float depth = -height;
  if (renderMode == 2.0) {
    point += vec2(0.012, -0.016) * lift;
    depth = 0.04;
  }
  vec2 position = origin + size * 0.5 + point;
  gl_Position = vec4(position * 2.0 - 1.0, depth, 1.0);
}
