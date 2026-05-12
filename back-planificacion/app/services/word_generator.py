from __future__ import annotations
import io
from datetime import date
from docx import Document
from docx.shared import Pt, Cm, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import copy

# ── Paleta corporativa ────────────────────────────────────────────────────────
BLUE_DARK  = RGBColor(0x00, 0x37, 0x81)   # Allianz #003781
BLUE_MED   = RGBColor(0x00, 0x66, 0xCC)   # #0066CC
BLUE_LIGHT = RGBColor(0xD6, 0xE4, 0xF7)   # fondo tabla cabecera
GRAY_DARK  = RGBColor(0x33, 0x33, 0x33)
GRAY_MED   = RGBColor(0x66, 0x66, 0x66)
GRAY_LIGHT = RGBColor(0xF5, 0xF7, 0xFA)
WHITE      = RGBColor(0xFF, 0xFF, 0xFF)
AMBER      = RGBColor(0xFF, 0xBF, 0x00)
RED        = RGBColor(0xC0, 0x39, 0x2B)
GREEN      = RGBColor(0x1A, 0x7A, 0x4A)

CATEGORY_LABELS = {
    "analisis":        "Análisis",
    "java":            "Java",
    "cobol":           "COBOL",
    "apigee":          "APIGEE",
    "pruebas_tecnicas":"Pruebas Técnicas",
    "qa":              "QA",
    "documentacion":   "Documentación",
    "despliegue":      "Despliegue",
}

RISK_COLOR = {
    "Bajo":    GREEN,
    "Medio":   AMBER,
    "Alto":    RED,
    "Crítico": RED,
}

COMPLEXITY_COLOR = {
    "Baja":    GREEN,
    "Media":   BLUE_MED,
    "Alta":    AMBER,
    "Crítica": RED,
}


# ── Helpers de XML/OOXML ──────────────────────────────────────────────────────

def _set_cell_bg(cell, hex_color: str):
    tc   = cell._tc
    tcPr = tc.get_or_add_tcPr()
    shd  = OxmlElement("w:shd")
    shd.set(qn("w:val"),   "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"),  hex_color)
    tcPr.append(shd)


def _set_cell_border(cell, **kwargs):
    tc   = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcBorders = OxmlElement("w:tcBorders")
    for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
        val = kwargs.get(side, {"sz": "4", "val": "single", "color": "D0D7E3"})
        el  = OxmlElement(f"w:{side}")
        for k, v in val.items():
            el.set(qn(f"w:{k}"), v)
        tcBorders.append(el)
    tcPr.append(tcBorders)


def _add_toc(doc: Document):
    """Inserta un campo TOC que Word actualiza al abrir."""
    para = doc.add_paragraph()
    run  = para.add_run()
    fld  = OxmlElement("w:fldChar")
    fld.set(qn("w:fldCharType"), "begin")
    run._r.append(fld)

    run2  = para.add_run()
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = ' TOC \\o "1-3" \\h \\z \\u '
    run2._r.append(instr)

    run3 = para.add_run()
    fld2 = OxmlElement("w:fldChar")
    fld2.set(qn("w:fldCharType"), "separate")
    run3._r.append(fld2)

    run4 = para.add_run()
    fld3 = OxmlElement("w:fldChar")
    fld3.set(qn("w:fldCharType"), "end")
    run4._r.append(fld3)

    note = doc.add_paragraph()
    note.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_note = note.add_run("[ Abrir en Microsoft Word y presionar Ctrl+A → F9 para actualizar el índice ]")
    run_note.font.size   = Pt(8)
    run_note.font.color.rgb = GRAY_MED
    run_note.font.italic = True


def _page_break(doc: Document):
    para = doc.add_paragraph()
    run  = para.add_run()
    br   = OxmlElement("w:br")
    br.set(qn("w:type"), "page")
    run._r.append(br)


def _hr(doc: Document, color: str = "003781"):
    para = doc.add_paragraph()
    pPr  = para._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    bot  = OxmlElement("w:bottom")
    bot.set(qn("w:val"),   "single")
    bot.set(qn("w:sz"),    "6")
    bot.set(qn("w:space"), "1")
    bot.set(qn("w:color"), color)
    pBdr.append(bot)
    pPr.append(pBdr)
    return para


def _heading(doc: Document, text: str, level: int = 1, numbered: str = ""):
    h = doc.add_heading("", level=level)
    h.clear()
    if numbered:
        run_num = h.add_run(f"{numbered}  ")
        run_num.font.color.rgb = BLUE_MED
        run_num.font.size      = Pt(13 if level == 1 else 11)
        run_num.bold           = True
    run = h.add_run(text)
    run.font.color.rgb = BLUE_DARK
    run.font.size      = Pt(13 if level == 1 else 11)
    run.bold           = True
    h.paragraph_format.space_before = Pt(14)
    h.paragraph_format.space_after  = Pt(6)
    return h


def _subheading(doc: Document, text: str, numbered: str = ""):
    _heading(doc, text, level=2, numbered=numbered)


def _body(doc: Document, text: str, *, bold=False, color: RGBColor | None = None):
    p   = doc.add_paragraph()
    run = p.add_run(text)
    run.font.size = Pt(10)
    run.bold      = bold
    if color:
        run.font.color.rgb = color
    p.paragraph_format.space_after = Pt(4)
    return p


def _bullet(doc: Document, text: str, *, color: RGBColor | None = None):
    p   = doc.add_paragraph(style="List Bullet")
    run = p.add_run(text)
    run.font.size = Pt(10)
    if color:
        run.font.color.rgb = color
    p.paragraph_format.space_after = Pt(2)
    return p


def _fmt(n) -> str:
    if n is None:
        return "—"
    n = float(n)
    return f"{int(n)}h" if n == int(n) else f"{n:.1f}h"


# ── Secciones del documento ───────────────────────────────────────────────────

def _cover(doc: Document, data: dict):
    # Banda superior azul simulada con párrafo coloreado
    band = doc.add_paragraph()
    band.paragraph_format.space_before = Pt(0)
    band.paragraph_format.space_after  = Pt(0)
    run = band.add_run("  NTT DATA · Allianz  ")
    run.font.size      = Pt(11)
    run.font.bold      = True
    run.font.color.rgb = WHITE
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"),   "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"),  "003781")
    band._p.get_or_add_pPr().append(shd)

    doc.add_paragraph()
    doc.add_paragraph()

    # Título principal
    title_p = doc.add_paragraph()
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = title_p.add_run("ESTIMACIÓN PARAMÉTRICA DE ESFUERZO")
    r.font.size      = Pt(22)
    r.font.bold      = True
    r.font.color.rgb = BLUE_DARK

    # Subtítulo (nombre del requerimiento)
    sub_p = doc.add_paragraph()
    sub_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    titulo = data.get("titulo", "Requerimiento")
    rs = sub_p.add_run(titulo)
    rs.font.size      = Pt(14)
    rs.font.color.rgb = BLUE_MED
    rs.font.bold      = True

    doc.add_paragraph()
    _hr(doc)
    doc.add_paragraph()

    # Ficha del documento
    ficha_rows = [
        ("Cliente",      "Allianz Seguros"),
        ("Proveedor",    "NTT DATA"),
        ("Fecha",        date.today().strftime("%d/%m/%Y")),
        ("Versión",      "1.0"),
        ("Clasificación","Confidencial – Uso Interno"),
    ]
    tbl = doc.add_table(rows=len(ficha_rows), cols=2)
    tbl.style             = "Table Grid"
    tbl.alignment         = WD_TABLE_ALIGNMENT.CENTER
    tbl.columns[0].width  = Cm(5)
    tbl.columns[1].width  = Cm(9)
    for i, (label, val) in enumerate(ficha_rows):
        cells = tbl.rows[i].cells
        _set_cell_bg(cells[0], "003781")
        r0 = cells[0].paragraphs[0].add_run(label)
        r0.font.bold      = True
        r0.font.color.rgb = WHITE
        r0.font.size      = Pt(10)
        cells[1].paragraphs[0].add_run(val).font.size = Pt(10)

    doc.add_paragraph()
    doc.add_paragraph()

    # Resumen del requerimiento en cuadro
    box_p = doc.add_paragraph()
    box_p.paragraph_format.left_indent  = Cm(1)
    box_p.paragraph_format.right_indent = Cm(1)
    box_run = box_p.add_run(data.get("resumen_requerimiento", ""))
    box_run.font.size   = Pt(10)
    box_run.font.italic = True
    box_run.font.color.rgb = GRAY_DARK


def _section_resumen(doc: Document, data: dict):
    _heading(doc, "RESUMEN EJECUTIVO", numbered="1.")

    totales = data.get("totales", {})
    riesgo  = data.get("factor_riesgo", {})
    nivel   = data.get("nivel_complejidad", "—")

    kpis = [
        ("Total Final (con riesgo)",   _fmt(data.get("total_final")),          "003781"),
        ("Total sin afectación riesgo", _fmt(totales.get("subtotal_sin_riesgo")), "0066CC"),
        ("Nivel de Complejidad",        nivel,                                  "1A7A4A" if nivel == "Baja" else "FFBF00" if nivel == "Media" else "C0392B"),
        ("Factor de Riesgo",            f"{riesgo.get('nivel','—')} (+{riesgo.get('porcentaje',0)}%)", "C0392B"),
    ]

    tbl = doc.add_table(rows=1, cols=4)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, (label, val, color) in enumerate(kpis):
        cell = tbl.rows[0].cells[i]
        cell.width = Cm(3.5)
        _set_cell_bg(cell, "F5F7FA")
        p_label = cell.add_paragraph()
        rl = p_label.add_run(label)
        rl.font.size      = Pt(8)
        rl.font.bold      = True
        rl.font.color.rgb = RGBColor(0x66, 0x66, 0x66)
        p_label.paragraph_format.space_after = Pt(2)

        p_val = cell.add_paragraph()
        rv    = p_val.add_run(val)
        rv.font.size = Pt(14)
        rv.font.bold = True
        try:
            rv.font.color.rgb = RGBColor(int(color[0:2],16), int(color[2:4],16), int(color[4:6],16))
        except Exception:
            rv.font.color.rgb = BLUE_DARK

    doc.add_paragraph()

    # Tabla de totales por fase
    _body(doc, "Distribución de esfuerzo por fase:", bold=True)
    fase_rows = [
        ("Análisis",       totales.get("total_analisis",        0)),
        ("Construcción",   totales.get("total_construccion",     0)),
        ("Pruebas Técnicas", totales.get("total_pruebas_tecnicas", 0)),
        ("QA",             totales.get("total_qa",              0)),
        ("Documentación",  totales.get("total_documentacion",   0)),
        ("Despliegue",     totales.get("total_despliegue",      0)),
        ("Afectación Riesgo", riesgo.get("horas_riesgo",        0)),
    ]
    tbl2 = doc.add_table(rows=len(fase_rows) + 1, cols=3)
    tbl2.style     = "Table Grid"
    tbl2.alignment = WD_TABLE_ALIGNMENT.LEFT

    headers = ["Fase", "Horas", "% del Total"]
    for j, h in enumerate(headers):
        cell = tbl2.rows[0].cells[j]
        _set_cell_bg(cell, "003781")
        r = cell.paragraphs[0].add_run(h)
        r.font.bold      = True
        r.font.color.rgb = WHITE
        r.font.size      = Pt(9)

    total_final = float(data.get("total_final") or 1)
    for i, (fase, horas) in enumerate(fase_rows):
        row = tbl2.rows[i + 1]
        row.cells[0].paragraphs[0].add_run(fase).font.size = Pt(9)
        h_run = row.cells[1].paragraphs[0].add_run(_fmt(horas))
        h_run.font.size = Pt(9)
        h_run.font.bold = True
        pct  = (float(horas) / total_final * 100) if total_final else 0
        row.cells[2].paragraphs[0].add_run(f"{pct:.1f}%").font.size = Pt(9)
        if i % 2 == 0:
            _set_cell_bg(row.cells[0], "F5F7FA")
            _set_cell_bg(row.cells[1], "F5F7FA")
            _set_cell_bg(row.cells[2], "F5F7FA")

    # Fila de total
    tbl2.add_row()
    total_row = tbl2.rows[-1]
    _set_cell_bg(total_row.cells[0], "D6E4F7")
    _set_cell_bg(total_row.cells[1], "D6E4F7")
    _set_cell_bg(total_row.cells[2], "D6E4F7")
    r0 = total_row.cells[0].paragraphs[0].add_run("TOTAL FINAL")
    r0.font.bold = True; r0.font.size = Pt(10); r0.font.color.rgb = BLUE_DARK
    r1 = total_row.cells[1].paragraphs[0].add_run(_fmt(data.get("total_final")))
    r1.font.bold = True; r1.font.size = Pt(12); r1.font.color.rgb = BLUE_DARK
    r2 = total_row.cells[2].paragraphs[0].add_run("100%")
    r2.font.bold = True; r2.font.size = Pt(10); r2.font.color.rgb = BLUE_DARK


def _section_consolidada(doc: Document, data: dict):
    _heading(doc, "TABLA CONSOLIDADA (TIPO CLIENTE)", numbered="2.")
    _body(doc, "Estimación oficial alineada al modelo base de horas del cliente Allianz / NTT DATA.")

    totales = data.get("totales", {})
    riesgo  = data.get("factor_riesgo", {})

    rows = [
        ("Análisis",                                totales.get("total_analisis", 0)),
        ("Construcción Java",                        data.get("categorias", {}).get("java", {}).get("subtotal", 0)),
        ("Construcción COBOL",                       data.get("categorias", {}).get("cobol", {}).get("subtotal", 0)),
        ("Construcción APIGEE",                      data.get("categorias", {}).get("apigee", {}).get("subtotal", 0)),
        ("Pruebas Técnicas (10% construcción)",      totales.get("total_pruebas_tecnicas", 0)),
        ("QA (10% construcción)",                    totales.get("total_qa", 0)),
        ("Documentación",                            totales.get("total_documentacion", 0)),
        ("Despliegue",                               totales.get("total_despliegue", 0)),
        (f"Afectación Riesgo ({riesgo.get('nivel','—')} +{riesgo.get('porcentaje',0)}%)",
                                                     riesgo.get("horas_riesgo", 0)),
    ]

    tbl = doc.add_table(rows=len(rows) + 1, cols=2)
    tbl.style     = "Table Grid"
    tbl.alignment = WD_TABLE_ALIGNMENT.LEFT
    tbl.columns[0].width = Cm(11)
    tbl.columns[1].width = Cm(3)

    for cell, txt in zip(tbl.rows[0].cells, ["CATEGORÍA", "HORAS"]):
        _set_cell_bg(cell, "003781")
        r = cell.paragraphs[0].add_run(txt)
        r.font.bold = True; r.font.color.rgb = WHITE; r.font.size = Pt(10)

    for i, (cat, hrs) in enumerate(rows):
        row = tbl.rows[i + 1]
        if i % 2 == 0:
            _set_cell_bg(row.cells[0], "F5F7FA")
            _set_cell_bg(row.cells[1], "F5F7FA")
        # Riesgo row — tono ámbar
        if "Riesgo" in cat or "Afectación" in cat:
            _set_cell_bg(row.cells[0], "FFF8E1")
            _set_cell_bg(row.cells[1], "FFF8E1")
        row.cells[0].paragraphs[0].add_run(cat).font.size = Pt(10)
        r = row.cells[1].paragraphs[0].add_run(_fmt(hrs))
        r.font.size = Pt(10); r.font.bold = True

    # Total row
    tbl.add_row()
    tr = tbl.rows[-1]
    for c in tr.cells:
        _set_cell_bg(c, "003781")
    r0 = tr.cells[0].paragraphs[0].add_run("TOTAL ESTIMACIÓN FINAL")
    r0.font.bold = True; r0.font.color.rgb = WHITE; r0.font.size = Pt(11)
    r1 = tr.cells[1].paragraphs[0].add_run(_fmt(data.get("total_final")))
    r1.font.bold = True; r1.font.color.rgb = WHITE; r1.font.size = Pt(13)


def _section_drivers(doc: Document, data: dict):
    _heading(doc, "DESGLOSE DE DRIVERS POR CATEGORÍA", numbered="3.")
    _body(doc, "Cada driver es cuantificado de forma individual, permitiendo trazabilidad y auditoría de la estimación.")

    categorias = data.get("categorias", {})
    sub_num    = 1
    for key, label in CATEGORY_LABELS.items():
        cat = categorias.get(key, {})
        drivers = cat.get("drivers", [])
        subtotal = cat.get("subtotal", 0)
        if not drivers and subtotal == 0:
            continue

        _subheading(doc, label, numbered=f"3.{sub_num}")
        sub_num += 1

        if not drivers:
            _body(doc, "Sin drivers activados para esta categoría.", color=GRAY_MED)
            continue

        tbl = doc.add_table(rows=len(drivers) + 1, cols=4)
        tbl.style     = "Table Grid"
        tbl.alignment = WD_TABLE_ALIGNMENT.LEFT
        tbl.columns[0].width = Cm(6)
        tbl.columns[1].width = Cm(2)
        tbl.columns[2].width = Cm(2.5)
        tbl.columns[3].width = Cm(2.5)

        for cell, h in zip(tbl.rows[0].cells, ["Driver", "Cant.", "H/Unit.", "Total"]):
            _set_cell_bg(cell, "0066CC")
            r = cell.paragraphs[0].add_run(h)
            r.font.bold = True; r.font.color.rgb = WHITE; r.font.size = Pt(9)

        for i, d in enumerate(drivers):
            row = tbl.rows[i + 1]
            if i % 2 == 0:
                for c in row.cells:
                    _set_cell_bg(c, "F5F7FA")
            row.cells[0].paragraphs[0].add_run(d.get("nombre", "")).font.size = Pt(9)
            row.cells[1].paragraphs[0].add_run(str(d.get("cantidad", ""))).font.size = Pt(9)
            row.cells[2].paragraphs[0].add_run(_fmt(d.get("horas_unitarias"))).font.size = Pt(9)
            r = row.cells[3].paragraphs[0].add_run(_fmt(d.get("total_horas")))
            r.font.size = Pt(9); r.font.bold = True; r.font.color.rgb = BLUE_DARK

        # Subtotal row
        tbl.add_row()
        sr = tbl.rows[-1]
        _set_cell_bg(sr.cells[0], "D6E4F7")
        _set_cell_bg(sr.cells[3], "D6E4F7")
        rl = sr.cells[0].paragraphs[0].add_run(f"Subtotal {label}")
        rl.font.bold = True; rl.font.size = Pt(9); rl.font.color.rgb = BLUE_DARK
        rv = sr.cells[3].paragraphs[0].add_run(_fmt(subtotal))
        rv.font.bold = True; rv.font.size = Pt(10); rv.font.color.rgb = BLUE_DARK

        # Descripción de drivers
        for d in drivers:
            desc = d.get("descripcion", "")
            if desc:
                p = doc.add_paragraph()
                p.paragraph_format.left_indent = Cm(0.5)
                p.paragraph_format.space_after  = Pt(2)
                r = p.add_run(f"• {d.get('nombre','')}:  ")
                r.font.bold = True; r.font.size = Pt(8); r.font.color.rgb = GRAY_DARK
                r2 = p.add_run(desc)
                r2.font.size = Pt(8); r2.font.color.rgb = GRAY_MED

        doc.add_paragraph()


def _section_perfiles(doc: Document, data: dict):
    _heading(doc, "DISTRIBUCIÓN POR PERFILES", numbered="4.")
    _body(doc, "Asignación de horas por perfil profesional según metodología NTT DATA.")

    perfiles = [p for p in data.get("perfiles", []) if float(p.get("horas", 0)) > 0]
    if not perfiles:
        _body(doc, "Sin información de perfiles.", color=GRAY_MED)
        return

    total_h = sum(float(p.get("horas", 0)) for p in perfiles)

    tbl = doc.add_table(rows=len(perfiles) + 1, cols=3)
    tbl.style     = "Table Grid"
    tbl.alignment = WD_TABLE_ALIGNMENT.LEFT
    tbl.columns[0].width = Cm(6)
    tbl.columns[1].width = Cm(3)
    tbl.columns[2].width = Cm(3)

    for cell, h in zip(tbl.rows[0].cells, ["Perfil", "Horas", "Participación"]):
        _set_cell_bg(cell, "003781")
        r = cell.paragraphs[0].add_run(h)
        r.font.bold = True; r.font.color.rgb = WHITE; r.font.size = Pt(10)

    for i, p in enumerate(perfiles):
        row = tbl.rows[i + 1]
        if i % 2 == 0:
            _set_cell_bg(row.cells[0], "F5F7FA")
            _set_cell_bg(row.cells[1], "F5F7FA")
            _set_cell_bg(row.cells[2], "F5F7FA")
        row.cells[0].paragraphs[0].add_run(p.get("perfil", "")).font.size = Pt(10)
        r = row.cells[1].paragraphs[0].add_run(_fmt(p.get("horas")))
        r.font.size = Pt(10); r.font.bold = True
        pct = (float(p.get("horas", 0)) / total_h * 100) if total_h else 0
        row.cells[2].paragraphs[0].add_run(f"{pct:.1f}%").font.size = Pt(10)

    # Total
    tbl.add_row()
    tr = tbl.rows[-1]
    _set_cell_bg(tr.cells[0], "D6E4F7"); _set_cell_bg(tr.cells[1], "D6E4F7"); _set_cell_bg(tr.cells[2], "D6E4F7")
    rl = tr.cells[0].paragraphs[0].add_run("TOTAL")
    rl.font.bold = True; rl.font.color.rgb = BLUE_DARK; rl.font.size = Pt(10)
    rv = tr.cells[1].paragraphs[0].add_run(_fmt(total_h))
    rv.font.bold = True; rv.font.color.rgb = BLUE_DARK; rv.font.size = Pt(11)
    tr.cells[2].paragraphs[0].add_run("100%").font.size = Pt(10)


def _section_riesgo(doc: Document, data: dict):
    _heading(doc, "ANÁLISIS DE RIESGO", numbered="5.")

    riesgo = data.get("factor_riesgo", {})
    nivel  = riesgo.get("nivel", "—")
    pct    = riesgo.get("porcentaje", 0)
    horas  = riesgo.get("horas_riesgo", 0)
    razones = riesgo.get("razones", [])

    # Ficha de riesgo
    tbl = doc.add_table(rows=1, cols=3)
    tbl.alignment = WD_TABLE_ALIGNMENT.LEFT
    for cell, label, val in zip(
        tbl.rows[0].cells,
        ["Nivel de Riesgo", "Factor Aplicado", "Horas Adicionales"],
        [nivel, f"+{pct}%", _fmt(horas)],
    ):
        _set_cell_bg(cell, "F5F7FA")
        p1 = cell.add_paragraph()
        r1 = p1.add_run(label)
        r1.font.size = Pt(8); r1.font.bold = True; r1.font.color.rgb = GRAY_MED
        p1.paragraph_format.space_after = Pt(2)
        p2 = cell.add_paragraph()
        r2 = p2.add_run(val)
        r2.font.size = Pt(14); r2.font.bold = True
        try:
            r2.font.color.rgb = RISK_COLOR.get(nivel, GRAY_DARK)
        except Exception:
            pass

    doc.add_paragraph()

    if razones:
        _body(doc, "Factores de riesgo identificados:", bold=True)
        for r in razones:
            _bullet(doc, r)

    # Tabla de niveles de referencia
    doc.add_paragraph()
    _body(doc, "Tabla de referencia de niveles de riesgo:", bold=True)
    niveles = [
        ("Bajo",    "+0%",  "Sin factores de riesgo identificados"),
        ("Medio",   "+10%", "Cambio batch productivo / impacto financiero / integración externa"),
        ("Alto",    "+20%", "Dependencias no definidas / datos no estructurados"),
        ("Crítico", "+30%", "Mainframe legacy sin documentación / múltiples factores simultáneos"),
    ]
    tbl2 = doc.add_table(rows=len(niveles) + 1, cols=3)
    tbl2.style = "Table Grid"
    for cell, h in zip(tbl2.rows[0].cells, ["Nivel", "Factor", "Criterio"]):
        _set_cell_bg(cell, "003781")
        r = cell.paragraphs[0].add_run(h)
        r.font.bold = True; r.font.color.rgb = WHITE; r.font.size = Pt(9)
    ref_colors = ["1A7A4A", "FFBF00", "C0392B", "C0392B"]
    for i, (nv, fc, crit) in enumerate(niveles):
        row = tbl2.rows[i + 1]
        c = ref_colors[i]
        _set_cell_bg(row.cells[0], "F5F7FA")
        rc = row.cells[0].paragraphs[0].add_run(nv)
        rc.font.bold = True; rc.font.size = Pt(9)
        try:
            rc.font.color.rgb = RGBColor(int(c[0:2],16), int(c[2:4],16), int(c[4:6],16))
        except Exception:
            pass
        row.cells[1].paragraphs[0].add_run(fc).font.size = Pt(9)
        row.cells[2].paragraphs[0].add_run(crit).font.size = Pt(9)

    # Nivel de complejidad
    doc.add_paragraph()
    _body(doc, "Nivel de complejidad del requerimiento:", bold=True)
    nivel_comp = data.get("nivel_complejidad", "—")
    comp_p = doc.add_paragraph()
    rc = comp_p.add_run(f"  {nivel_comp}  ")
    rc.font.size = Pt(14); rc.font.bold = True
    try:
        rc.font.color.rgb = COMPLEXITY_COLOR.get(nivel_comp, BLUE_DARK)
    except Exception:
        pass
    comp_p.add_run(f"  ({data.get('totales', {}).get('total_construccion', 0)}h de construcción)").font.size = Pt(10)


def _section_supuestos(doc: Document, data: dict):
    _heading(doc, "SUPUESTOS Y OBSERVACIONES", numbered="6.")

    supuestos    = data.get("supuestos",    [])
    observaciones = data.get("observaciones", [])

    _subheading(doc, "Supuestos", numbered="6.1")
    if supuestos:
        for s in supuestos:
            _bullet(doc, s)
    else:
        _body(doc, "Sin supuestos registrados.", color=GRAY_MED)

    doc.add_paragraph()
    _subheading(doc, "Observaciones", numbered="6.2")
    if observaciones:
        for o in observaciones:
            _bullet(doc, o, color=RGBColor(0xB7, 0x60, 0x0E))
    else:
        _body(doc, "Sin observaciones registradas.", color=GRAY_MED)


def _footer(doc: Document):
    """Pie de página con texto corporativo y número de página."""
    section = doc.sections[0]
    footer  = section.footer
    ft_para = footer.paragraphs[0]
    ft_para.clear()
    ft_para.alignment = WD_ALIGN_PARAGRAPH.CENTER

    r1 = ft_para.add_run("NTT DATA · Allianz Seguros  |  Estimación Paramétrica  |  Confidencial")
    r1.font.size = Pt(8); r1.font.color.rgb = GRAY_MED

    ft_para.add_run("    ")

    # Número de página
    fld = OxmlElement("w:fldChar")
    fld.set(qn("w:fldCharType"), "begin")
    run_fld = ft_para.add_run()
    run_fld._r.append(fld)

    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    run_instr = ft_para.add_run()
    run_instr._r.append(instr)

    fld2 = OxmlElement("w:fldChar")
    fld2.set(qn("w:fldCharType"), "end")
    run_fld2 = ft_para.add_run()
    run_fld2._r.append(fld2)


def _set_margins(doc: Document):
    for section in doc.sections:
        section.top_margin    = Cm(2)
        section.bottom_margin = Cm(2)
        section.left_margin   = Cm(2.5)
        section.right_margin  = Cm(2.5)


# ── Punto de entrada ─────────────────────────────────────────────────────────

def generate_word(data: dict) -> bytes:
    """Genera el documento Word y retorna los bytes del archivo."""
    doc = Document()
    _set_margins(doc)
    _footer(doc)

    # ① Portada
    _cover(doc, data)
    _page_break(doc)

    # ② Índice
    h_toc = doc.add_heading("", level=1)
    h_toc.clear()
    r_toc = h_toc.add_run("TABLA DE CONTENIDO")
    r_toc.font.color.rgb = BLUE_DARK; r_toc.font.size = Pt(14); r_toc.bold = True
    _hr(doc)
    _add_toc(doc)
    _page_break(doc)

    # ③ Secciones
    _section_resumen(doc, data)
    doc.add_paragraph()
    _section_consolidada(doc, data)
    _page_break(doc)
    _section_drivers(doc, data)
    _page_break(doc)
    _section_perfiles(doc, data)
    doc.add_paragraph()
    _section_riesgo(doc, data)
    doc.add_paragraph()
    _section_supuestos(doc, data)

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
