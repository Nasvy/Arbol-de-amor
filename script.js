document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('treeCanvas');
    const ctx = canvas.getContext('2d');
    const seedButton = document.getElementById('seedButton');
    const timeContainer = document.getElementById('timeContainer');
    const timerDisplay = document.getElementById('timer');

    // Ajusta el tamaño del canvas al 75% del tamaño de la ventana
    canvas.width = window.innerWidth * 0.75;
    canvas.height = window.innerHeight * 0.75;

    let treeGrowing = false; // Controla si la animación de crecimiento está activa
    let animationFrameId; // Guarda el ID del requestAnimationFrame para poder cancelarlo
    let currentGrowthStage = 0; // Etapa actual de crecimiento del árbol
    let maxGrowthStages = 200; // Número total de etapas para completar el crecimiento
    let treeCompleted = false; // Indica si el árbol ha terminado de crecer

    let timerIntervalId; // Para el contador de tiempo (Nuevo)

    // --- Parámetros del Árbol ---
    const treeColor = '#3E8B83'; // Color principal del tronco y ramas
    // Los colores de las hojas se usarán para el color del texto del corazón
    // Los colores de las hojas se usarán para el color del texto del corazón
    const leafColors = [
        '#E57373', // Rojo claro
        '#F06292', // Rosado fuerte
        '#BA68C8', // Lila
        '#FFD54F', // Amarillo
        '#FFB74D', // Naranja
        '#F48FB1', // Rosado pálido
        '#9575CD', // Morado claro
        '#FF8A65', // Rojo anaranjado
        '#FFF176'  // Amarillo pálido
        // Puedes añadir más variaciones de estos tonos si lo deseas
    ];
    const maxTrunkLength = canvas.height * 0.6; // Longitud máxima del tronco
    const maxTrunkBaseWidth = canvas.width * 0.06; // Ancho máximo de la base del tronco
    const minTrunkTopWidth = 2; // Ancho mínimo de la parte superior del tronco
    const curveMagnitude = canvas.width * 0.05; // Magnitud de la curvatura del tronco

    // Ajustes para ramitas más finas y cortas (los "pelitos")
    const branchLengthFactor = 0.5;
    const branchWidthFactor = 0.3;
    const branchAngleSpread = Math.PI / 6;

    // Parámetros para las hojas de corazón
    const heartSizeBase = 25; // Tamaño base para los caracteres de corazón en el árbol
    const numHeartsTotal = 1400; // Cantidad total de hojas de corazón en la copa (VALOR ANTERIOR RESTAURADO)

    // Factor para convertir centímetros a píxeles. Aproximación basada en 96 DPI (1 pulgada = 2.54 cm).
    const CM_TO_PX_FACTOR = (canvas.width / window.innerWidth) * 37.8 / 2.54; // Px por cm relativo al canvas

    const PADDING_CM = 2; // El padding de 2 cm
    const PADDING_PX = PADDING_CM * CM_TO_PX_FACTOR; // Convertir 2cm a píxeles

    // Fecha de inicio para el contador (19 de julio de 2023, 00:00:00)
    const startDate = new Date('2023-07-19T00:00:00'); // Nuevo

    // Función para calcular el ancho del tronco en una altura dada
    function getTrunkWidthAtHeight(height, finalTrunkLength, trunkBaseWidth, trunkTopWidth) {
        const normalizedHeight = height / finalTrunkLength;
        return trunkBaseWidth - (trunkBaseWidth - trunkTopWidth) * normalizedHeight;
    }

    // --- Función para dibujar un corazón (AHORA DIBUJA EL CARÁCTER '❤') ---
    // x, y: centro del corazón
    // size: el tamaño del corazón (usado como font-size)
    function drawHeart(x, y, size, color) {
        ctx.fillStyle = color;
        // Establece el tamaño de la fuente y la familia (puedes ajustar la fuente si lo deseas)
        ctx.font = `${size}px Arial`;
        ctx.textAlign = 'center'; // Centra el texto horizontalmente en x
        ctx.textBaseline = 'middle'; // Centra el texto verticalmente en y
        ctx.fillText('❤', x, y); // Dibuja el carácter de corazón
    }

    // Función para calcular el desplazamiento horizontal para la curvatura del tronco
    function getTrunkCurveXOffset(height) {
        const normalizedHeight = height / maxTrunkLength;
        return curveMagnitude * Math.pow(normalizedHeight, 2);
    }

    // Función para dibujar el tronco estilizado
    function drawStylizedTrunk(startX, startY, currentLength, finalTrunkLength, trunkBaseWidth, trunkTopWidth) {
        const numSegments = 10;
        const segmentLength = currentLength / numSegments;

        ctx.beginPath();
        ctx.moveTo(startX - trunkBaseWidth / 2, startY);
        for (let i = 0; i <= numSegments; i++) {
            const segmentHeight = i * segmentLength;
            const currentWidth = getTrunkWidthAtHeight(segmentHeight, finalTrunkLength, trunkBaseWidth, trunkTopWidth);
            const xOffset = getTrunkCurveXOffset(segmentHeight);
            ctx.lineTo(startX - currentWidth / 2 + xOffset, startY - segmentHeight);
        }
        for (let i = numSegments; i >= 0; i--) {
            const segmentHeight = i * segmentLength;
            const currentWidth = getTrunkWidthAtHeight(segmentHeight, finalTrunkLength, trunkBaseWidth, trunkTopWidth);
            const xOffset = getTrunkCurveXOffset(segmentHeight);
            ctx.lineTo(startX + currentWidth / 2 + xOffset, startY - segmentHeight);
        }
        ctx.closePath();
        ctx.fillStyle = treeColor;
        ctx.fill();
    }

    // Función recursiva para dibujar una rama
    function drawBranch(x, y, length, angle, baseWidth, currentSubBranchLevel, maxAllowedSubBranchLevels, parentBranchGrowthRatio = 1) {
        if (parentBranchGrowthRatio <= 0 || length < 1 || baseWidth < 0.5) return;

        const currentBranchGrowthRatio = parentBranchGrowthRatio;

        if (currentSubBranchLevel > maxAllowedSubBranchLevels) {
            return;
        }

        const effectiveLength = length * currentBranchGrowthRatio;
        const numSegments = 5;
        const segmentLength = effectiveLength / numSegments;
        const minBranchTipWidth = 0.5;

        ctx.beginPath();
        const startPerpendicularAngle = angle + Math.PI / 2;
        ctx.moveTo(x + (baseWidth / 2) * Math.sin(startPerpendicularAngle), y - (baseWidth / 2) * Math.cos(startPerpendicularAngle));
        for (let i = 0; i <= numSegments; i++) {
            const currentSegmentLength = i * segmentLength;
            const currentWidth = baseWidth - (baseWidth - minBranchTipWidth) * (currentSegmentLength / effectiveLength);
            const px = x + currentSegmentLength * Math.sin(angle);
            const py = y - currentSegmentLength * Math.cos(angle);
            const perpendicularAngle = angle + Math.PI / 2;
            ctx.lineTo(px + (currentWidth / 2) * Math.sin(perpendicularAngle), py - (currentWidth / 2) * Math.cos(perpendicularAngle));
        }
        for (let i = numSegments; i >= 0; i--) {
            const currentSegmentLength = i * segmentLength;
            const currentWidth = baseWidth - (baseWidth - minBranchTipWidth) * (currentSegmentLength / effectiveLength);
            const px = x + currentSegmentLength * Math.sin(angle);
            const py = y - currentSegmentLength * Math.cos(angle);
            const perpendicularAngle = angle + Math.PI / 2;
            ctx.lineTo(px - (currentWidth / 2) * Math.sin(perpendicularAngle), py + (currentWidth / 2) * Math.cos(perpendicularAngle));
        }
        ctx.closePath();
        ctx.fillStyle = treeColor;
        ctx.fill();

        if (currentSubBranchLevel < maxAllowedSubBranchLevels) {
            const numNewSubBranches = Math.floor(Math.random() * 2) + 1;
            for (let i = 0; i < numNewSubBranches; i++) {
                const branchPointLength = effectiveLength * (0.3 + Math.random() * 0.4);
                const branchPointX = x + branchPointLength * Math.sin(angle);
                const branchPointY = y - branchPointLength * Math.cos(angle);
                const nextLength = length * branchLengthFactor;
                const nextWidth = baseWidth * branchWidthFactor;
                drawBranch(
                    branchPointX,
                    branchPointY,
                    nextLength,
                    angle + (Math.random() - 0.5) * branchAngleSpread,
                    nextWidth,
                    currentSubBranchLevel + 1,
                    0,
                    currentBranchGrowthRatio
                );
            }
        }
    }

    const mainBranchesDefinitions = [
        { relativeTrunkY: 0.20, angle: Math.PI / 6, baseLengthFactor: 0.60, baseWidthFactor: 0.6, maxSubBranches: 1, appearanceStage: 60 },
        { relativeTrunkY: 0.40, angle: -Math.PI / 5, baseLengthFactor: 0.55, baseWidthFactor: 0.55, maxSubBranches: 2, appearanceStage: 80 },
        { relativeTrunkY: 0.60, angle: Math.PI / 3.5, baseLengthFactor: 0.50, baseWidthFactor: 0.45, maxSubBranches: 1, appearanceStage: 100 },
        { relativeTrunkY: 0.80, angle: -Math.PI / 2.8, baseLengthFactor: 0.40, baseWidthFactor: 0.35, maxSubBranches: 2, appearanceStage: 120 }
    ];

    function animateSeedGrowth() {
        return new Promise(resolve => {
            let seedRadius = 0;
            const maxSeedRadius = 8;
            const seedX = canvas.width / 2;
            const seedY = canvas.height;

            const seedAnimationDuration = 800;
            let startTime = null;

            function growSeed(currentTime) {
                if (!startTime) startTime = currentTime;
                const elapsedTime = currentTime - startTime;

                seedRadius = Math.min(maxSeedRadius, (elapsedTime / seedAnimationDuration) * maxSeedRadius);

                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.beginPath();
                ctx.arc(seedX, seedY, seedRadius, 0, Math.PI * 2);
                ctx.fillStyle = treeColor;
                ctx.fill();

                if (elapsedTime < seedAnimationDuration) {
                    animationFrameId = requestAnimationFrame(growSeed);
                } else {
                    resolve();
                }
            }
            animationFrameId = requestAnimationFrame(growSeed);
        });
    }

    let fallingElements = [];

    // Función para verificar si un punto está dentro de la silueta de la copa.
    function isPointInPath(x, y, pathFunc) {
        ctx.beginPath();
        pathFunc();
        return ctx.isPointInPath(x, y);
    }

    function createFallingElement() {
        if (!treeCompleted) return;

        const element = document.createElement('div');
        element.textContent = '❤'; // El carácter de corazón para los que caen
        element.classList.add('falling-element');
        element.style.color = leafColors[Math.floor(Math.random() * leafColors.length)]; // Corazones que caen con colores variados
        element.style.setProperty('--random-x', Math.random()); // Para variar el desplazamiento lateral

        // El centro horizontal del corazón debe estar alineado con el centro del tronco (base)
        const crownCenterX = canvas.width / 2; // El centro del tronco en su base

        // --- Dimensiones y posición ajustadas para la forma de la copa (para la caída de elementos) ---
        // Estos valores deben coincidir con los de `generateHeartLeaves`
        
        // Estimación de la extensión horizontal máxima de las ramas
        const maxBranchXExtend = maxTrunkLength * mainBranchesDefinitions[0].baseLengthFactor * 1.5; // Estimación generosa
        const desiredHeartWidth = (maxBranchXExtend * 2) + (PADDING_PX * 2); // Doble de la extensión + padding a ambos lados

        // Estimación de la extensión vertical máxima de las ramas
        // La rama más alta es la primera (relativeTrunkY 0.20)
        const topOfBranchesY = canvas.height - (maxTrunkLength * (1 - mainBranchesDefinitions[0].relativeTrunkY)) - (maxTrunkLength * mainBranchesDefinitions[0].baseLengthFactor * 0.9); // Altura de la rama + un factor de su longitud
        // AJUSTE: Mover 1cm hacia arriba (restar PADDING_PX, que es aprox 1cm)
        const desiredHeartTopY = topOfBranchesY - PADDING_PX;

        // Altura del corazón para que su "punta" inferior quede cerca del inicio de las ramas
        const lowestBranchY = canvas.height - (maxTrunkLength * (1 - mainBranchesDefinitions[mainBranchesDefinitions.length - 1].relativeTrunkY));
        // AJUSTE: Subir la base del corazón 1cm (restar PADDING_PX)
        const heartPointY = lowestBranchY + (maxTrunkLength * 0.2) - PADDING_PX; // Un poco por debajo de la rama más baja, subiendo 1cm
        
        const desiredHeartHeight = (heartPointY - desiredHeartTopY) + PADDING_PX; // Altura desde la punta superior hasta la inferior + padding

        const heartCenterYForOutline = desiredHeartTopY + desiredHeartHeight * 0.5;

        const heartOutlinePath = () => {
            const x = crownCenterX;
            const y = heartCenterYForOutline;
            const currentSize = desiredHeartHeight; // Usamos la altura como base para escalar
            const scale = currentSize / 100;
            
            // Para ajustar el ancho y la altura con esta escala, es una relación
            // width / height = desiredHeartWidth / desiredHeartHeight
            const widthScale = desiredHeartWidth / desiredHeartHeight;

            // Puntos de control para la forma de corazón (copa)
            // ESTOS SON LOS VALORES MODIFICADOS PARA HACER LA FORMA MÁS DE CORAZÓN
            ctx.moveTo(x + (50 * widthScale - 50 * widthScale) * scale, y + (0 - 90) * scale); // Punto de inicio (pico superior, más arriba para la hendidura)
            ctx.bezierCurveTo(
                x + (10 * widthScale - 50 * widthScale) * scale, y + (0 - 50) * scale,   // Control Point 1 (más a la izquierda, más arriba para la curva superior)
                x + (-40 * widthScale - 50 * widthScale) * scale, y + (50 - 50) * scale,  // Control Point 2 (más a la izquierda, hacia el centro del corazón)
                x + (50 * widthScale - 50 * widthScale) * scale, y + (100 - 50) * scale  // End Point (punta inferior del corazón, ajustada verticalmente)
            );
            ctx.bezierCurveTo(
                x + (140 * widthScale - 50 * widthScale) * scale, y + (50 - 50) * scale,  // Control Point 1 (más a la derecha, hacia el centro del corazón)
                x + (90 * widthScale - 50 * widthScale) * scale, y + (0 - 50) * scale,   // Control Point 2 (más a la derecha, más arriba para la curva superior)
                x + (50 * widthScale - 50 * widthScale) * scale, y + (0 - 90) * scale    // End Point (regreso al pico superior, creando la hendidura)
            );
        };

        // --- AJUSTE CLAVE AQUÍ: Refinar el área de búsqueda para la caída ---
        // Aseguramos que los corazones empiecen a caer desde la parte superior del árbol
        const searchMinX = crownCenterX - desiredHeartWidth / 2; // Desde el borde izquierdo de la copa
        const searchMaxX = crownCenterX + desiredHeartWidth / 2; // Hasta el borde derecho de la copa
        const searchMinY = desiredHeartTopY; // Desde la parte más alta de la copa
        const searchMaxY = desiredHeartTopY + (desiredHeartHeight * 0.4); // Hasta el 40% superior de la altura de la copa (ajusta este valor si lo necesitas)

        let randomX, randomY;
        let attempts = 0;
        const maxAttempts = 100;

        do {
            randomX = searchMinX + Math.random() * (searchMaxX - searchMinX);
            randomY = searchMinY + Math.random() * (searchMaxY - searchMinY);
            attempts++;
        } while (!isPointInPath(randomX, randomY, heartOutlinePath) && attempts < maxAttempts);

        if (attempts >= maxAttempts) return; // Si no se encuentra un punto válido después de muchos intentos, saltar este elemento

        // --- SOLUCIÓN PARA LA POSICIÓN DE CAÍDA: APLICAR EL TRANSLATE MANUALMENTE ---
        let adjustedOffsetX = 0;
        // Si el árbol está completo y se ha aplicado la transformación,
        // necesitamos calcular el offset del canvas.
        if (treeCompleted) {
            // El canvas se mueve `canvas.width * 0.25` hacia la izquierda.
            // Entonces, para el punto de caída, debemos RESTAR ese valor a `canvas.offsetLeft`.
            // O, más simple, restar el valor del randomX.
            adjustedOffsetX = -canvas.width * 0.25;
        }

        element.style.left = `${canvas.offsetLeft + randomX + adjustedOffsetX}px`;
        element.style.top = `${canvas.offsetTop + randomY}px`;

        const animationDuration = 5 + Math.random() * 5;
        element.style.animationDuration = `${animationDuration}s`;
        element.style.fontSize = `${1.5 + Math.random() * 1}em`; // Tamaño de corazón cayendo original

        document.body.appendChild(element);

        fallingElements.push(element);

        element.addEventListener('animationend', () => {
            element.remove();
            fallingElements = fallingElements.filter(el => el !== element);
        });
    }

    let elementFallInterval;
    let heartLeaves = [];

    // --- Función para generar las posiciones de las hojas de corazón en forma de copa ---
    function generateHeartLeaves() {
        heartLeaves = [];

        // El centro horizontal del corazón debe estar alineado con el centro del tronco (base)
        const crownCenterX = canvas.width / 2;

        // --- AJUSTES CLAVE AQUÍ PARA LA FORMA DEL CORAZÓN DE LA COPA ---
        // Estimación de la extensión horizontal máxima de las ramas
        const maxBranchXExtend = maxTrunkLength * mainBranchesDefinitions[0].baseLengthFactor * 1.5; // Estimación generosa
        const desiredHeartWidth = (maxBranchXExtend * 2) + (PADDING_PX * 2); // Doble de la extensión + padding a ambos lados

        // Estimación de la extensión vertical máxima de las ramas
        // La rama más alta es la primera (relativeTrunkY 0.20)
        const topOfBranchesY = canvas.height - (maxTrunkLength * (1 - mainBranchesDefinitions[0].relativeTrunkY)) - (maxTrunkLength * mainBranchesDefinitions[0].baseLengthFactor * 0.9); // Altura de la rama + un factor de su longitud
        // AJUSTE: Mover 1cm hacia arriba (restar PADDING_PX, que es aprox 1cm)
        const desiredHeartTopY = topOfBranchesY - PADDING_PX;

        // Altura del corazón para que su "punta" inferior quede cerca del inicio de las ramas
        const lowestBranchY = canvas.height - (maxTrunkLength * (1 - mainBranchesDefinitions[mainBranchesDefinitions.length - 1].relativeTrunkY));
        // AJUSTE: Subir la base del corazón 1cm (restar PADDING_PX)
        const heartPointY = lowestBranchY + (maxTrunkLength * 0.2) - PADDING_PX; // Un poco por debajo de la rama más baja, subiendo 1cm
        
        const desiredHeartHeight = (heartPointY - desiredHeartTopY) + PADDING_PX; // Altura desde la punta superior hasta la inferior + padding

        const heartCenterY = desiredHeartTopY + desiredHeartHeight * 0.5;

        const heartOutlinePath = () => {
            const x = crownCenterX;
            const y = heartCenterY;
            const currentSize = desiredHeartHeight; // Usamos la altura como base para escalar
            const scale = currentSize / 100;

            // Para ajustar el ancho y la altura con esta escala, es una relación
            // width / height = desiredHeartWidth / desiredHeartHeight
            const widthScale = desiredHeartWidth / desiredHeartHeight;

            // Puntos de control para la forma de corazón (copa)
            // ESTOS SON LOS VALORES MODIFICADOS PARA HACER LA FORMA MÁS DE CORAZÓN
            ctx.moveTo(x + (50 * widthScale - 50 * widthScale) * scale, y + (0 - 90) * scale); // Punto de inicio (pico superior, más arriba para la hendidura)
            ctx.bezierCurveTo(
                x + (10 * widthScale - 50 * widthScale) * scale, y + (0 - 50) * scale,   // Control Point 1 (más a la izquierda, más arriba para la curva superior)
                x + (-40 * widthScale - 50 * widthScale) * scale, y + (50 - 50) * scale,  // Control Point 2 (más a la izquierda, hacia el centro del corazón)
                x + (50 * widthScale - 50 * widthScale) * scale, y + (100 - 50) * scale  // End Point (punta inferior del corazón, ajustada verticalmente)
            );
            ctx.bezierCurveTo(
                x + (140 * widthScale - 50 * widthScale) * scale, y + (50 - 50) * scale,  // Control Point 1 (más a la derecha, hacia el centro del corazón)
                x + (90 * widthScale - 50 * widthScale) * scale, y + (0 - 50) * scale,   // Control Point 2 (más a la derecha, más arriba para la curva superior)
                x + (50 * widthScale - 50 * widthScale) * scale, y + (0 - 90) * scale    // End Point (regreso al pico superior, creando la hendidura)
            );
        };

        const searchMinX = crownCenterX - desiredHeartWidth / 2 - heartSizeBase;
        const searchMaxX = crownCenterX + desiredHeartWidth / 2 + heartSizeBase;
        const searchMinY = desiredHeartTopY - heartSizeBase;
        const searchMaxY = desiredHeartTopY + desiredHeartHeight + heartSizeBase;

        let heartsGenerated = 0;
        let attempts = 0;
        const maxAttemptsTotal = numHeartsTotal * 10;

        while (heartsGenerated < numHeartsTotal && attempts < maxAttemptsTotal) {
            attempts++;
            const randomX = searchMinX + Math.random() * (searchMaxX - searchMinX);
            const randomY = searchMinY + Math.random() * (searchMaxY - searchMinY);

            if (isPointInPath(randomX, randomY, heartOutlinePath)) {
                heartLeaves.push({
                    x: randomX,
                    y: randomY,
                    size: heartSizeBase * (0.7 + Math.random() * 0.5),
                    color: leafColors[Math.floor(Math.random() * leafColors.length)]
                });
                heartsGenerated++;
            }
        }
        // No ordenar aquí para evitar el lag. Se dibujan en el orden en que se generan.
        // Si necesitas un orden específico (por ejemplo, de arriba a abajo), puedes ordenar aquí una vez.
        // Para simplemente evitar el lag, no hagas el sort en cada frame de animación.
        // heartLeaves.sort(() => Math.random() - 0.5); // COMENTADO PARA EVITAR LAG
    }

    // --- Función para actualizar el contador de tiempo (Nuevo) ---
    function updateTimer() {
        const now = new Date();
        const diff = now.getTime() - startDate.getTime(); // Diferencia en milisegundos

        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        const remainingSeconds = seconds % 60;
        const remainingMinutes = minutes % 60;
        const remainingHours = hours % 24;

        timerDisplay.innerHTML = `
            ${days} días<br>
            ${remainingHours} horas<br>
            ${remainingMinutes} minutos<br>
            ${remainingSeconds} segundos
        `;
    }

    // --- Función principal de animación del crecimiento del árbol ---
    function animateTreeGrowth() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const startX = canvas.width / 2;
        const startY = canvas.height;
        const currentTrunkLength = maxTrunkLength * (currentGrowthStage / maxGrowthStages);

        drawStylizedTrunk(startX, startY, currentTrunkLength, maxTrunkLength, maxTrunkBaseWidth, minTrunkTopWidth);

        mainBranchesDefinitions.forEach(branchDef => {
            const branchGrowthRatio = Math.max(0, Math.min(1, (currentGrowthStage - branchDef.appearanceStage) / (maxGrowthStages * 0.1)));

            if (branchGrowthRatio > 0) {
                const branchHeightOnTrunk = currentTrunkLength * (1 - branchDef.relativeTrunkY);
                const branchOriginX = startX + getTrunkCurveXOffset(branchHeightOnTrunk);
                const branchOriginY = startY - branchHeightOnTrunk;
                const trunkWidthAtOrigin = getTrunkWidthAtHeight(branchHeightOnTrunk, maxTrunkLength, maxTrunkBaseWidth, minTrunkTopWidth);
                const branchBaseWidth = trunkWidthAtOrigin * branchDef.baseWidthFactor;
                const branchLength = maxTrunkLength * branchDef.baseLengthFactor;
                let maxAllowedSubBranchLevelsForMainBranch = 0;
                const subBranchAppearanceProgress = (currentGrowthStage - branchDef.appearanceStage) / (maxGrowthStages * 0.1);
                if (subBranchAppearanceProgress >= 0.5) {
                    maxAllowedSubBranchLevelsForMainBranch = branchDef.maxSubBranches;
                }
                drawBranch(
                    branchOriginX,
                    branchOriginY,
                    branchLength,
                    branchDef.angle,
                    branchBaseWidth,
                    0,
                    maxAllowedSubBranchLevelsForMainBranch,
                    branchGrowthRatio
                );
            }
        });

        // --- INICIO DE LA MODIFICACIÓN PARA APARICIÓN DE HOJAS ---
        // Define el momento en que las hojas comenzarán a aparecer.
        // maxGrowthStages * 0.9 significa que las hojas comenzarán a aparecer
        // cuando el árbol haya alcanzado el 90% de su crecimiento total.
        // Esto asegura que el tronco y las ramas principales estén casi completamente formadas.
        const leafAppearanceStartStage = maxGrowthStages * 0.9; // 90% del crecimiento del árbol

        if (currentGrowthStage >= leafAppearanceStartStage) {
            // Calcula el progreso de la aparición de las hojas en la fase final
            const leafGrowthProgress = (currentGrowthStage - leafAppearanceStartStage) / (maxGrowthStages - leafAppearanceStartStage);
            
            // Determina cuántas hojas dibujar en base al progreso
            // Usa Math.min para asegurar que no se dibuje más del total de hojas disponibles.
            const heartsToDraw = Math.floor(leafGrowthProgress * heartLeaves.length);
            
            // Dibuja las hojas
            for (let i = 0; i < heartsToDraw; i++) {
                const heart = heartLeaves[i]; // Accede directamente a la hoja, no la ordena de nuevo
                drawHeart(heart.x, heart.y, heart.size, heart.color);
            }
        }
        // --- FIN DE LA MODIFICACIÓN PARA APARICIÓN DE HOJAS ---

        if (currentGrowthStage < maxGrowthStages) {
            currentGrowthStage++;
            animationFrameId = requestAnimationFrame(animateTreeGrowth);
        } else {
            treeCompleted = true;
            console.log("Árbol completo!");
            if (!elementFallInterval) {
                elementFallInterval = setInterval(createFallingElement, 500);
            }
            // Mover el árbol a la izquierda al finalizar la animación (Nuevo)
            canvas.style.transform = `translateX(-${canvas.width * 0.25}px)`; // Mover 25% del ancho del canvas a la izquierda
            timeContainer.classList.add('visible'); // Hacer visible el contenedor de tiempo (Nuevo)
            timerIntervalId = setInterval(updateTimer, 1000); // Iniciar el contador (Nuevo)
            updateTimer(); // Actualizar el contador inmediatamente (Nuevo)
        }
    }

    // --- Event listener para el botón "¡Planta la Semilla!" ---
    seedButton.addEventListener('click', async () => {
        if (treeGrowing) return;

        treeGrowing = true;
        seedButton.disabled = true;
        seedButton.textContent = 'Plantando...';

        // Restablecer el estado del canvas y el temporizador (Nuevo)
        canvas.style.transform = 'translateX(0)'; // Volver el canvas a su posición original
        timeContainer.classList.remove('visible'); // Ocultar el contador
        clearInterval(timerIntervalId); // Detener el contador si estaba activo


        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        clearInterval(elementFallInterval);
        fallingElements.forEach(el => el.remove());
        fallingElements = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        currentGrowthStage = 0;
        treeCompleted = false;
        generateHeartLeaves(); // Generar posiciones de las hojas una sola vez al inicio
        console.log("Número de hojas generadas:", heartLeaves.length);

        await animateSeedGrowth();
        seedButton.textContent = '¡Creciendo!';
        animationFrameId = requestAnimationFrame(animateTreeGrowth);
    });

    // --- Manejar redimensionamiento de la ventana para mantener el árbol centrado y dibujado ---
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth * 0.75;
        canvas.height = window.innerHeight * 0.75;
        // Si el árbol ya está completo, redibujarlo en la nueva posición
        if (treeCompleted) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const startX = canvas.width / 2;
            const startY = canvas.height;
            drawStylizedTrunk(startX, startY, maxTrunkLength, maxTrunkLength, maxTrunkBaseWidth, minTrunkTopWidth);
            mainBranchesDefinitions.forEach(branchDef => {
                const branchHeightOnTrunk = maxTrunkLength * (1 - branchDef.relativeTrunkY);
                const branchOriginX = startX + getTrunkCurveXOffset(branchHeightOnTrunk);
                const branchOriginY = startY - branchHeightOnTrunk;
                const trunkWidthAtOrigin = getTrunkWidthAtHeight(branchHeightOnTrunk, maxTrunkLength, maxTrunkBaseWidth, minTrunkTopWidth);
                const branchBaseWidth = trunkWidthAtOrigin * branchDef.baseLengthFactor;
                const branchLength = maxTrunkLength * branchDef.baseLengthFactor;
                drawBranch(
                    branchOriginX,
                    branchOriginY,
                    branchLength,
                    branchDef.angle,
                    branchBaseWidth,
                    0,
                    branchDef.maxSubBranches,
                    1
                );
            });
            generateHeartLeaves(); // Volver a generar y dibujar las hojas
            heartLeaves.forEach(heart => {
                drawHeart(heart.x, heart.y, heart.size, heart.color);
            });
            // Asegurarse de que el desplazamiento se mantenga o se ajuste (Nuevo)
            canvas.style.transform = `translateX(-${canvas.width * 0.25}px)`;
        } else {
            // Si el árbol no está completo, pero se redimensiona, resetear la posición si es necesario (Nuevo)
            canvas.style.transform = 'translateX(0)';
        }
        // Actualizar el contador si está visible (Nuevo)
        if (timeContainer.classList.contains('visible')) {
            updateTimer();
        }
    });
});