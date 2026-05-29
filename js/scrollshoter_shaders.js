// scrollshoter_shaders.js

export const floorVertexShader = `
    varying vec2 vUv;
    varying vec3 vPosition;
    void main() {
        vUv = uv;
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const floorFragmentShader = `
    uniform float time;
    uniform vec3 color;
    varying vec2 vUv;
    varying vec3 vPosition;
    void main() {
        // Стабильная сетка на основе локальных координат (не зависит от растяжения UV)
        vec2 uv = vPosition.xy * 0.25; 
        uv.y -= time * 1.5;
        
        float gridX = smoothstep(0.88, 0.96, fract(uv.x));
        float gridY = smoothstep(0.88, 0.96, fract(uv.y));
        float neon = max(gridX, gridY);
        
        // Гасим сетку задолго до горизонта (игровая зона по Z доходит до -50, что в локальных Y равно 50)
        // Диапазон от 35.0 до 65.0 полностью убирает пиксельную рябь на горизонте
        float fadeY = 1.0 - smoothstep(35.0, 65.0, vPosition.y);
        
        // Мягкое гашение сетки позади игрока
        float fadeBehind = smoothstep(-30.0, -10.0, vPosition.y);
        
        // Ограничение видимости сетки по бокам от трассы
        float fadeX = 1.0 - smoothstep(5.0, 25.0, abs(vPosition.x));
        
        float fade = fadeX * fadeY * fadeBehind;
        
        vec3 baseColor = vec3(0.04, 0.01, 0.08);
        gl_FragColor = vec4(mix(baseColor, color, neon * fade), 1.0);
    }
`;