precision mediump float;
uniform sampler2D artwork;
uniform sampler2D plainArtwork;
uniform float outlineOpacity;
uniform vec3 backColor;
uniform mediump float renderMode;
uniform float shadowStrength;
varying vec2 textureCoordinate;
varying float creaseDistance;
varying float lift;
void main() {
  vec4 outlined = texture2D(artwork, textureCoordinate);
  vec4 plain = texture2D(plainArtwork, textureCoordinate);
  float alpha = mix(plain.a, outlined.a, outlineOpacity);
  vec3 premultiplied = mix(plain.rgb * plain.a, outlined.rgb * outlined.a, outlineOpacity);
  vec4 color = vec4(premultiplied / max(alpha, 0.001), alpha);
  if (renderMode == 2.0) {
    float coverage = color.a * 0.4;
    coverage += texture2D(artwork, textureCoordinate + vec2(0.003, 0.0)).a * 0.15;
    coverage += texture2D(artwork, textureCoordinate - vec2(0.003, 0.0)).a * 0.15;
    coverage += texture2D(artwork, textureCoordinate + vec2(0.0, 0.003)).a * 0.15;
    coverage += texture2D(artwork, textureCoordinate - vec2(0.0, 0.003)).a * 0.15;
    gl_FragColor = vec4(vec3(0.0), coverage * min(lift, 1.0) * 0.18 * shadowStrength);
    return;
  }
  if (color.a < 0.001) discard;
  if (!gl_FrontFacing) {
    gl_FragColor = vec4(backColor, color.a);
    return;
  }
  // The lifted fold casts a narrow shadow onto the attached front below it.
  float shadow = creaseDistance <= 0.0
    ? 0.22 * exp(creaseDistance * 3.0) * shadowStrength : 0.0;
  gl_FragColor = vec4(color.rgb * (1.0 - shadow), color.a);
}
