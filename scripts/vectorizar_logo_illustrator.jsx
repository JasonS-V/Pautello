#target illustrator

/**
 * Script de Automatización para Adobe Illustrator:
 * Vectorización fiel de Pautello Logo y exportación a SVG en /public
 *
 * Para ejecutarlo:
 * 1. Abre Adobe Illustrator.
 * 2. Ve a: Archivo > Secuencias de comandos > Otra secuencia de comandos... (Ctrl + F12).
 * 3. Selecciona este archivo "vectorizar_logo_illustrator.jsx".
 */

(function() {
    try {
        var baseDir = "C:/Users/jason/OneDrive/Documents/Coding/partituras";
        var imgFile = new File(baseDir + "/public/pautello-logo-original.png");
        
        if (!imgFile.exists) {
            alert("No se encontró la imagen original en:\n" + imgFile.fsName);
            return;
        }

        // 1. Crear documento a tamaño original
        var doc = app.documents.add(DocumentColorSpace.RGB, 749, 263);
        doc.views[0].zoom = 1.0;

        // 2. Colocar la imagen original
        var placed = doc.placedItems.add();
        placed.file = imgFile;
        placed.left = 0;
        placed.top = 263;
        placed.width = 749;
        placed.height = 263;

        // 3. Aplicar Calco de Imagen nativo de Illustrator
        var traced = placed.trace();
        var opt = traced.tracing.tracingOptions;
        
        // Ajustes para máxima fidelidad en degradados y logotipo
        try {
            opt.tracingMode = TracingModeType.TRACINGMODECOLOR;
            opt.maxColors = 30;
            opt.colorFidelity = 98;
            opt.pathFidelity = 96;
            opt.cornerFidelity = 80;
            opt.noiseFidelity = 2;
            opt.ignoreWhite = false;
        } catch(e) {
            // Compatibilidad entre versiones de Illustrator
        }

        // 4. Expandir el calco en vectores puros de Adobe
        app.executeMenuCommand("Image Trace Expand");

        // 5. Opciones de exportación SVG
        var svgFile = new File(baseDir + "/public/pautello-logo.svg");
        var svgOpts = new ExportOptionsSVG();
        svgOpts.embedRasterImages = false;
        svgOpts.cssProperties = SVGCSSPropertyLocation.STYLEATTRIBUTES;
        svgOpts.fontSubsetting = SVGFontSubsetting.None;
        svgOpts.documentEncoding = SVGDocumentEncoding.UTF8;
        svgOpts.compressed = false;
        svgOpts.coordinatePrecision = 3;

        doc.exportFile(svgFile, ExportType.SVG, svgOpts);

        alert("¡Éxito total!\n\nEl logotipo ha sido vectorizado con el motor nativo de Adobe Illustrator y guardado directamente en:\n" + svgFile.fsName);
    } catch (err) {
        alert("Ocurrió un error durante la ejecución:\n" + err.message);
    }
})();
