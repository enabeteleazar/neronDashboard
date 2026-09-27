import { Color, FrontSide, Material, MeshLambertMaterial, NormalBlending } from "three";
import type { ColorRepresentation } from "three";

/** Rendu hologramme : texture d'origine en luminance teintee + fresnel de bord. */
export function makeHologram(
  src: Material | Material[],
  color: ColorRepresentation,
) {
  const build = (from: any) => {
    const tex = from?.map ?? null;
    const m = new MeshLambertMaterial({
      color: 0x000000,
      emissive: 0xffffff,
      emissiveMap: tex,
      map: tex,
      transparent: false,
      alphaTest: 0.5,          // decoupe des cheveux, sans empilement
      depthWrite: true,
      blending: NormalBlending,
      side: FrontSide,
    });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTint = { value: new Color(color) };
      shader.vertexShader =
        "varying vec3 vNrm;\nvarying vec3 vDir;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           vNrm = normalize(normalMatrix * objectNormal);
           vDir = normalize(-(modelViewMatrix * vec4(transformed, 1.0)).xyz);`
        );
      shader.fragmentShader =
        "uniform vec3 uTint;\nvarying vec3 vNrm;\nvarying vec3 vDir;\n" +
        shader.fragmentShader.replace(
          "#include <dithering_fragment>",
          `#include <dithering_fragment>
           float lum  = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
           lum = pow(clamp(lum, 0.0, 1.0), 2.2);      // ecrase les tons clairs
           float fres = pow(1.0 - abs(dot(normalize(vNrm), normalize(vDir))), 3.0);
           gl_FragColor.rgb = uTint * (lum * 0.55 + fres * 0.9);
           gl_FragColor.a = 1.0;`
        );
    };
    return m;
  };
  return Array.isArray(src) ? src.map(build) : build(src);
}
