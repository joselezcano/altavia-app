import React from 'react';
import { DimensionValue, View, ViewStyle } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

// Colores de marca predeterminados
const BRAND_NAVY = '#193566';
const BRAND_GOLD = '#c2b690';
const BRAND_GREY = '#a0a5b5';

export interface AltaviaLogoProps {
    /** Tamaño uniforme (ancho, mantiene el aspect ratio) */
    size?: DimensionValue;
    /** Ancho específico (anula size si se proporciona) */
    width?: DimensionValue;
    /** Alto específico (anula size si se proporciona) */
    height?: DimensionValue;
    /** Forzar todo el logo a un solo color (monocromo, ej: 'white') */
    color?: string;
    /** Estilo para el contenedor View */
    style?: ViewStyle;
}

/**
 * Componente de Logotipo de Altavia (Aviation Platform).
 * Vectorizado y optimizado con react-native-svg.
 * Soporta cambios de tamaño y color monocromo.
 */
const AltaviaLogo: React.FC<AltaviaLogoProps> = ({
    size,
    width,
    height,
    color,
    style,
}) => {
    // Ancho base original: 600, Alto base original: 150 (ratio 4:1)
    const baseWidth = 600;
    const baseHeight = 150;

    // Cálculo de dimensiones manteniendo el aspect ratio si solo se proporciona 'size'
    const calculatedWidth = width || size || 300;
    const calculatedHeight = height || (typeof calculatedWidth === 'number' ? (calculatedWidth / 4) : 75);

    // Funciones de ayuda para determinar el color de relleno
    const getNavyFill = () => (color ? color : BRAND_NAVY);
    const getGoldFill = () => (color ? color : BRAND_GOLD);
    const getGreyFill = () => (color ? color : BRAND_GREY);

    return (
        <View style={[{ width: calculatedWidth, height: calculatedHeight, aspectRatio: 4 / 1 }, style]}>
            <Svg
                width={calculatedWidth as number | string}
                height={calculatedHeight as number | string}
                viewBox="0 0 600 150"
                fill="none"
            >
                <G id="altavia-logo-group">
                    {/* --- SÍMBOLO 'A' GEOMÉTRICO (Navy) --- */}
                    <Path
                        id="a-symbol-base"
                        d="M 50.4,124.6 L 31.8,63.1 L 111.4,63.1 L 130.0,124.6 H 146.4 L 88.0,25.4 L 63.8,25.4 L 5.4,124.6 H 21.8 M 81.2,42.8 L 97.4,63.1 H 65.0 L 81.2,42.8 Z"
                        fill={getNavyFill()}
                    />

                    {/* --- ARCO Y PUNTO DORADO (Gold) --- */}
                    <Path
                        id="gold-arc"
                        d="M 125.0,28.6 C 115.0,10.0, 95.0,10.0, 75.0,18.0 C 55.0,26.0, 45.0,40.0, 45.0,60.0 C 45.0,80.0, 60.0,90.0, 81.2,90.0"
                        stroke={getGoldFill()}
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    {/* El punto circular dorado al inicio del arco */}
                    <Path
                        id="gold-dot"
                        d="M 125.0,28.6 A 4,4 0 1,0 125.0,36.6 A 4,4 0 1,0 125.0,28.6 Z"
                        fill={getGoldFill()}
                    />

                    {/* --- ARCO INFERIOR AZUL PÁLIDO (Original Blue) --- */}
                    {/* Solo se dibuja si NO es modo monocromo, para mantener la estética original */}
                    {!color && (
                        <Path
                            id="pale-blue-arc"
                            d="M 81.2,106.6 C 60.0,106.6, 45.0,116.6, 45.0,136.6 C 45.0,156.6, 55.0,170.6, 75.0,178.6 C 95.0,186.6, 115.0,186.6, 125.0,168.6"
                            stroke="#bac2d1" // Azul pálido original
                            strokeWidth="2"
                            strokeDasharray="2 4"
                            strokeLinecap="round"
                        />
                    )}

                    {/* --- WORDMARK 'ALTAVIA' (Navy) --- */}
                    {/* 
            Nota: Para mayor fidelidad y compatibilidad con prop 'color',
            estoy usando rutas de glifos en lugar de SvgText.
          */}
                    <G id="altavia-wordmark" transform="translate(170, 45)">
                        {/* A */}
                        <Path d="M 12.0,52.0 L 1.2,2.0 H 8.4 L 15.6,52.0 H 12.0 Z" fill={getNavyFill()} />
                        <Path d="M 40.8,52.0 L 30.0,2.0 H 37.2 L 44.4,52.0 H 40.8 Z" fill={getNavyFill()} />
                        <Path d="M 14.0,30.0 H 39.0 V 36.0 H 14.0 V 30.0 Z" fill={getNavyFill()} />
                        {/* L */}
                        <Path d="M 52.0,2.0 V 52.0 H 80.0 V 46.0 H 58.0 V 2.0 H 52.0 Z" fill={getNavyFill()} />
                        {/* T */}
                        <Path d="M 85.0,8.0 V 2.0 H 125.0 V 8.0 H 108.0 V 52.0 H 102.0 V 8.0 H 85.0 Z" fill={getNavyFill()} />
                        {/* A (reutilizado) */}
                        <G transform="translate(130, 0)">
                            <Path d="M 12.0,52.0 L 1.2,2.0 H 8.4 L 15.6,52.0 H 12.0 Z" fill={getNavyFill()} />
                            <Path d="M 40.8,52.0 L 30.0,2.0 H 37.2 L 44.4,52.0 H 40.8 Z" fill={getNavyFill()} />
                            <Path d="M 14.0,30.0 H 39.0 V 36.0 H 14.0 V 30.0 Z" fill={getNavyFill()} />
                        </G>
                        {/* V */}
                        <Path d="M 185.0,2.0 L 202.0,52.0 L 219.0,2.0 H 226.0 L 206.0,58.0 H 198.0 L 178.0,2.0 H 185.0 Z" fill={getNavyFill()} />
                        {/* I */}
                        <Path d="M 235.0,2.0 V 52.0 H 241.0 V 2.0 H 235.0 Z" fill={getNavyFill()} />
                        {/* A (reutilizado) */}
                        <G transform="translate(250, 0)">
                            <Path d="M 12.0,52.0 L 1.2,2.0 H 8.4 L 15.6,52.0 H 12.0 Z" fill={getNavyFill()} />
                            <Path d="M 40.8,52.0 L 30.0,2.0 H 37.2 L 44.4,52.0 H 40.8 Z" fill={getNavyFill()} />
                            <Path d="M 14.0,30.0 H 39.0 V 36.0 H 14.0 V 30.0 Z" fill={getNavyFill()} />
                        </G>
                    </G>

                    {/* --- SUBTÍTULO 'AVIATION PLATFORM' (Grey) - Removido por compatibilidad --- */}
                </G>
            </Svg>
        </View>
    );
};

export default AltaviaLogo;