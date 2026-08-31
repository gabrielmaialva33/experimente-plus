# /// script
# requires-python = ">=3.11"
# dependencies = ["reportlab>=4.4,<5"]
# ///

"""Gera a documentação de negócio e dados do Experimente+ em PDF.

Uso:
    uv run scripts/build_documentation_pdf.py
    uv run scripts/build_documentation_pdf.py --output output/pdf/documentacao.pdf
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable, Sequence

from reportlab.graphics.shapes import Circle, Drawing, Line, Polygon, Rect, String
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    KeepTogether,
    LongTable,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "output" / "pdf" / "experimente-plus-documentacao-negocio-e-dados.pdf"

PAGE_W, PAGE_H = A4
MARGIN_X = 18 * mm
MARGIN_TOP = 20 * mm
MARGIN_BOTTOM = 17 * mm
CONTENT_W = PAGE_W - 2 * MARGIN_X

ORANGE = HexColor("#CF4217")
ORANGE_DARK = HexColor("#9E2F10")
ORANGE_PALE = HexColor("#FFF1EB")
NAVY = HexColor("#172554")
BLUE = HexColor("#2563EB")
BLUE_PALE = HexColor("#EFF6FF")
TEAL = HexColor("#0F766E")
TEAL_PALE = HexColor("#ECFDF5")
PURPLE = HexColor("#7C3AED")
PURPLE_PALE = HexColor("#F5F3FF")
INK = HexColor("#182230")
MUTED = HexColor("#667085")
LINE = HexColor("#D0D5DD")
SURFACE = HexColor("#F8FAFC")
WHITE = colors.white
GREEN = HexColor("#15803D")
AMBER = HexColor("#B45309")
RED = HexColor("#B42318")


pdfmetrics.registerFont(TTFont("Noto", "/usr/share/fonts/noto/NotoSans-Regular.ttf"))
pdfmetrics.registerFont(TTFont("Noto-Bold", "/usr/share/fonts/noto/NotoSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("Noto-Italic", "/usr/share/fonts/noto/NotoSans-Italic.ttf"))
pdfmetrics.registerFont(TTFont("NotoMono", "/usr/share/fonts/noto/NotoSansMono-Regular.ttf"))
pdfmetrics.registerFontFamily("Noto", normal="Noto", bold="Noto-Bold", italic="Noto-Italic")


def styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "Title",
            parent=base["Title"],
            fontName="Noto-Bold",
            fontSize=30,
            leading=34,
            textColor=WHITE,
            spaceAfter=5 * mm,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            fontName="Noto",
            fontSize=13,
            leading=19,
            textColor=HexColor("#FFE5D8"),
        ),
        "h1": ParagraphStyle(
            "Heading1",
            parent=base["Heading1"],
            fontName="Noto-Bold",
            fontSize=20,
            leading=24,
            textColor=NAVY,
            spaceBefore=2 * mm,
            spaceAfter=5 * mm,
            keepWithNext=True,
        ),
        "h2": ParagraphStyle(
            "Heading2",
            parent=base["Heading2"],
            fontName="Noto-Bold",
            fontSize=14,
            leading=18,
            textColor=ORANGE_DARK,
            spaceBefore=4 * mm,
            spaceAfter=2.5 * mm,
            keepWithNext=True,
        ),
        "h3": ParagraphStyle(
            "Heading3",
            parent=base["Heading3"],
            fontName="Noto-Bold",
            fontSize=10.5,
            leading=14,
            textColor=NAVY,
            spaceBefore=2.5 * mm,
            spaceAfter=1.3 * mm,
            keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="Noto",
            fontSize=8.6,
            leading=12.7,
            textColor=INK,
            spaceAfter=2.2 * mm,
        ),
        "small": ParagraphStyle(
            "Small",
            fontName="Noto",
            fontSize=7.3,
            leading=10.2,
            textColor=MUTED,
        ),
        "tiny": ParagraphStyle(
            "Tiny",
            fontName="Noto",
            fontSize=6.3,
            leading=8.4,
            textColor=INK,
        ),
        "caption": ParagraphStyle(
            "Caption",
            fontName="Noto-Italic",
            fontSize=7,
            leading=10,
            textColor=MUTED,
            alignment=TA_CENTER,
            spaceBefore=1.2 * mm,
            spaceAfter=3 * mm,
        ),
        "callout": ParagraphStyle(
            "Callout",
            fontName="Noto",
            fontSize=9,
            leading=13.5,
            textColor=INK,
        ),
        "metric": ParagraphStyle(
            "Metric",
            fontName="Noto-Bold",
            fontSize=18,
            leading=21,
            textColor=NAVY,
            alignment=TA_CENTER,
        ),
        "metric_label": ParagraphStyle(
            "MetricLabel",
            fontName="Noto",
            fontSize=7,
            leading=9.5,
            textColor=MUTED,
            alignment=TA_CENTER,
        ),
        "toc1": ParagraphStyle(
            "TOC1",
            fontName="Noto-Bold",
            fontSize=7.7,
            leading=9.2,
            textColor=NAVY,
            leftIndent=0,
            firstLineIndent=0,
            spaceBefore=0.5,
        ),
        "toc2": ParagraphStyle(
            "TOC2",
            fontName="Noto",
            fontSize=6.2,
            leading=7.2,
            textColor=MUTED,
            leftIndent=12,
            firstLineIndent=0,
        ),
        "table_head": ParagraphStyle(
            "TableHead",
            fontName="Noto-Bold",
            fontSize=7,
            leading=9,
            textColor=WHITE,
        ),
        "table_cell": ParagraphStyle(
            "TableCell",
            fontName="Noto",
            fontSize=6.7,
            leading=9.1,
            textColor=INK,
        ),
        "table_cell_bold": ParagraphStyle(
            "TableCellBold",
            fontName="Noto-Bold",
            fontSize=6.7,
            leading=9.1,
            textColor=NAVY,
        ),
    }


S = styles()


class ExperimenteDocTemplate(BaseDocTemplate):
    def __init__(self, filename: str):
        super().__init__(
            filename,
            pagesize=A4,
            leftMargin=MARGIN_X,
            rightMargin=MARGIN_X,
            topMargin=MARGIN_TOP,
            bottomMargin=MARGIN_BOTTOM,
            title="Experimente+ - Documentação de Negócio e Dados",
            author="Experimente+",
            subject="Requisitos, casos de uso, arquitetura e schemas de dados",
            creator="Experimente+ Documentation System",
        )
        body_frame = Frame(
            MARGIN_X,
            MARGIN_BOTTOM,
            CONTENT_W,
            PAGE_H - MARGIN_TOP - MARGIN_BOTTOM,
            id="body",
            leftPadding=0,
            rightPadding=0,
            topPadding=0,
            bottomPadding=0,
        )
        cover_frame = Frame(
            0,
            0,
            PAGE_W,
            PAGE_H,
            id="cover",
            showBoundary=0,
            leftPadding=0,
            rightPadding=0,
            topPadding=0,
            bottomPadding=0,
        )
        self.addPageTemplates(
            [
                PageTemplate(id="Cover", frames=[cover_frame], onPage=self.draw_cover),
                PageTemplate(id="Body", frames=[body_frame], onPage=self.draw_page),
            ]
        )

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph):
            style = flowable.style.name
            if style in ("Heading1", "Heading2"):
                level = 0 if style == "Heading1" else 1
                text = flowable.getPlainText()
                key = f"section-{self.seq.nextf('section')}"
                self.canv.bookmarkPage(key)
                self.canv.addOutlineEntry(text, key, level=level, closed=False)
                self.notify("TOCEntry", (level, text, self.page, key))

    def draw_cover(self, canvas, doc):
        canvas.saveState()
        canvas.setFillColor(NAVY)
        canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        canvas.setFillColor(ORANGE)
        canvas.rect(0, 0, 34 * mm, PAGE_H, fill=1, stroke=0)
        canvas.setFillColor(HexColor("#F97316"))
        canvas.circle(PAGE_W - 26 * mm, PAGE_H - 30 * mm, 34 * mm, fill=1, stroke=0)
        canvas.setFillColor(HexColor("#FB923C"))
        canvas.circle(PAGE_W - 10 * mm, 18 * mm, 44 * mm, fill=1, stroke=0)
        canvas.setStrokeColor(HexColor("#334155"))
        canvas.setLineWidth(0.8)
        for offset in range(0, 90, 9):
            canvas.line(48 * mm, 28 * mm + offset * mm, 178 * mm, 28 * mm + offset * mm)
        canvas.restoreState()

    def draw_page(self, canvas, doc):
        canvas.saveState()
        page = canvas.getPageNumber()
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.4)
        canvas.line(MARGIN_X, PAGE_H - 13 * mm, PAGE_W - MARGIN_X, PAGE_H - 13 * mm)
        canvas.setFont("Noto-Bold", 6.6)
        canvas.setFillColor(NAVY)
        canvas.drawString(MARGIN_X, PAGE_H - 10 * mm, "EXPERIMENTE+")
        canvas.setFont("Noto", 6.4)
        canvas.setFillColor(MUTED)
        canvas.drawRightString(
            PAGE_W - MARGIN_X,
            PAGE_H - 10 * mm,
            "Documentação de negócio e dados - Baseline EP-11",
        )
        canvas.line(MARGIN_X, 11 * mm, PAGE_W - MARGIN_X, 11 * mm)
        canvas.setFont("Noto", 6.2)
        canvas.drawString(MARGIN_X, 7 * mm, "Uso interno - versão 1.0 - 31/08/2026")
        canvas.drawRightString(PAGE_W - MARGIN_X, 7 * mm, f"{page - 1:02d}")
        canvas.restoreState()


class CoverContent(Flowable):
    def __init__(self):
        super().__init__()
        self.width = PAGE_W
        self.height = PAGE_H

    def draw(self):
        c = self.canv
        c.setFillColor(WHITE)
        c.setFont("Noto-Bold", 11)
        c.drawString(48 * mm, PAGE_H - 42 * mm, "EXPERIMENTE+")
        c.setFillColor(HexColor("#FDBA74"))
        c.setFont("Noto", 8)
        c.drawString(48 * mm, PAGE_H - 50 * mm, "PRODUTO, NEGÓCIO, ARQUITETURA E DADOS")

        p = Paragraph("Documentação de<br/>Negócio e Dados", S["title"])
        p.wrapOn(c, 125 * mm, 60 * mm)
        p.drawOn(c, 48 * mm, PAGE_H - 116 * mm)
        p2 = Paragraph(
            "Requisitos, jornadas, casos de uso, regras, arquitetura, modelo de dados e rastreabilidade do produto regional multicidade.",
            S["subtitle"],
        )
        p2.wrapOn(c, 118 * mm, 35 * mm)
        p2.drawOn(c, 48 * mm, PAGE_H - 148 * mm)

        c.setFillColor(WHITE)
        c.roundRect(48 * mm, 49 * mm, 122 * mm, 35 * mm, 4 * mm, fill=1, stroke=0)
        c.setFillColor(NAVY)
        c.setFont("Noto-Bold", 9)
        c.drawString(55 * mm, 72 * mm, "BASELINE EP-11")
        c.setFont("Noto", 7.5)
        c.setFillColor(MUTED)
        c.drawString(55 * mm, 63 * mm, "Catálogo, parceiros, analytics e benefícios")
        c.drawString(55 * mm, 56 * mm, "Versão 1.0 - 31 de agosto de 2026")


class SectionDivider(Flowable):
    def __init__(self, number: str, title: str, subtitle: str):
        super().__init__()
        self.number = number
        self.title = title
        self.subtitle = subtitle
        self.width = CONTENT_W
        self.height = 74 * mm

    def draw(self):
        c = self.canv
        c.setFillColor(NAVY)
        c.roundRect(0, 0, self.width, self.height, 5 * mm, fill=1, stroke=0)
        c.setFillColor(ORANGE)
        c.circle(self.width - 16 * mm, self.height - 15 * mm, 18 * mm, fill=1, stroke=0)
        c.setFillColor(HexColor("#334155"))
        c.roundRect(9 * mm, self.height - 23 * mm, 26 * mm, 11 * mm, 2 * mm, fill=1, stroke=0)
        c.setFont("Noto-Bold", 8)
        c.setFillColor(HexColor("#FDBA74"))
        c.drawCentredString(22 * mm, self.height - 19 * mm, f"SEÇÃO {self.number}")
        title = Paragraph(self.title, ParagraphStyle("divider", parent=S["h1"], fontSize=24, leading=28, textColor=WHITE))
        title.wrapOn(c, self.width - 28 * mm, 30 * mm)
        title.drawOn(c, 10 * mm, 25 * mm)
        sub = Paragraph(self.subtitle, ParagraphStyle("divider-sub", parent=S["body"], fontSize=9, leading=13, textColor=HexColor("#CBD5E1")))
        sub.wrapOn(c, self.width - 30 * mm, 18 * mm)
        sub.drawOn(c, 10 * mm, 9 * mm)


def P(text: str, style: str = "body") -> Paragraph:
    return Paragraph(text, S[style])


def H1(text: str) -> Paragraph:
    return Paragraph(text, S["h1"])


def H2(text: str) -> Paragraph:
    return Paragraph(text, S["h2"])


def H3(text: str) -> Paragraph:
    return Paragraph(text, S["h3"])


def bullet_list(items: Sequence[str], level: int = 0):
    result = []
    for item in items:
        result.append(
            Paragraph(
                item,
                ParagraphStyle(
                    f"bullet-{level}",
                    parent=S["body"],
                    leftIndent=(5 + level * 4) * mm,
                    firstLineIndent=-3 * mm,
                    bulletIndent=(1 + level * 4) * mm,
                    spaceAfter=1.3 * mm,
                ),
                bulletText="•",
            )
        )
    return result


def callout(title: str, text: str, color=ORANGE, background=ORANGE_PALE):
    data = [["", P(f"<b>{title}</b><br/>{text}", "callout")]]
    table = Table(data, colWidths=[3 * mm, CONTENT_W - 3 * mm], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), background),
        ("BACKGROUND", (0, 0), (0, 0), color),
        ("BOX", (0, 0), (-1, -1), 0.45, color),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), 0),
        ("TOPPADDING", (0, 0), (0, 0), 0),
        ("BOTTOMPADDING", (0, 0), (0, 0), 0),
        ("LEFTPADDING", (1, 0), (1, 0), 3 * mm),
        ("RIGHTPADDING", (1, 0), (1, 0), 3 * mm),
        ("TOPPADDING", (1, 0), (1, 0), 3 * mm),
        ("BOTTOMPADDING", (1, 0), (1, 0), 3 * mm),
    ]))
    return table


def styled_table(headers: Sequence[str], rows: Sequence[Sequence[str]], widths=None, repeat=True):
    prepared = [[P(h, "table_head") for h in headers]]
    for row in rows:
        prepared.append([
            P(str(cell), "table_cell_bold" if index == 0 else "table_cell")
            for index, cell in enumerate(row)
        ])
    table = LongTable(prepared, colWidths=widths, repeatRows=1 if repeat else 0, hAlign="LEFT")
    commands = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 2 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 1.6 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.6 * mm),
    ]
    for row_index in range(1, len(prepared)):
        if row_index % 2 == 0:
            commands.append(("BACKGROUND", (0, row_index), (-1, row_index), SURFACE))
    table.setStyle(TableStyle(commands))
    return table


def metric_cards(metrics: Sequence[tuple[str, str]]):
    cells = []
    width = CONTENT_W / len(metrics)
    for value, label in metrics:
        cells.append([P(value, "metric"), P(label, "metric_label")])
    t = Table([cells], colWidths=[width] * len(cells), hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
        ("BOX", (0, 0), (-1, -1), 0.4, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4 * mm),
    ]))
    return t


def arrow(d: Drawing, x1, y1, x2, y2, color=NAVY, width=1.1):
    d.add(Line(x1, y1, x2, y2, strokeColor=color, strokeWidth=width))
    if abs(x2 - x1) >= abs(y2 - y1):
        direction = 1 if x2 > x1 else -1
        d.add(Polygon([x2, y2, x2 - 5 * direction, y2 + 3, x2 - 5 * direction, y2 - 3], fillColor=color, strokeColor=color))
    else:
        direction = 1 if y2 > y1 else -1
        d.add(Polygon([x2, y2, x2 - 3, y2 - 5 * direction, x2 + 3, y2 - 5 * direction], fillColor=color, strokeColor=color))


def box(d: Drawing, x, y, w, h, title, subtitle="", fill=WHITE, stroke=LINE, title_color=NAVY):
    d.add(Rect(x, y, w, h, rx=7, ry=7, fillColor=fill, strokeColor=stroke, strokeWidth=0.8))
    d.add(String(x + w / 2, y + h - 14, title, fontName="Noto-Bold", fontSize=7.6, textAnchor="middle", fillColor=title_color))
    if subtitle:
        lines = subtitle.split("|")
        for idx, line in enumerate(lines[:4]):
            d.add(String(x + w / 2, y + h - 27 - idx * 10, line, fontName="Noto", fontSize=5.8, textAnchor="middle", fillColor=MUTED))


def architecture_diagram():
    d = Drawing(CONTENT_W, 250)
    layers = [
        ("Experiência", "Catálogo público | Carteira | Portal do parceiro | Backoffice", ORANGE_PALE, ORANGE),
        ("Aplicação", "Controllers Inertia/API | Services de domínio | Policies | Validators", BLUE_PALE, BLUE),
        ("Domínio", "Geografia | Taxonomia | Organizações | Estabelecimentos | Benefícios | Analytics", PURPLE_PALE, PURPLE),
        ("Persistência", "PostgreSQL transacional | Projeção de catálogo | Redis | Object storage", TEAL_PALE, TEAL),
    ]
    x, w, h = 14, CONTENT_W - 28, 46
    ys = [190, 132, 74, 16]
    for (title, subtitle, fill, stroke), y in zip(layers, ys):
        box(d, x, y, w, h, title, subtitle, fill=fill, stroke=stroke)
    for y in [190, 132, 74]:
        arrow(d, CONTENT_W / 2, y, CONTENT_W / 2, y - 10, color=MUTED)
        arrow(d, CONTENT_W / 2 + 13, y - 10, CONTENT_W / 2 + 13, y, color=MUTED)
    return d


def capability_map():
    d = Drawing(CONTENT_W, 250)
    groups = [
        (12, 150, "Descoberta", ["Cidades e categorias", "Busca e filtros", "Aberto agora", "Páginas públicas"], ORANGE_PALE, ORANGE),
        (169, 150, "Parceiros", ["Organizações", "Memberships e convites", "Cadastro de unidades", "Editor e submissão"], BLUE_PALE, BLUE),
        (326, 150, "Operação", ["Geografia e taxonomia", "Moderação", "Gestão de acessos", "Feedback do piloto"], PURPLE_PALE, PURPLE),
        (90, 45, "Inteligência", ["Eventos pseudônimos", "Funil de descoberta", "No-result searches", "Retenção"], TEAL_PALE, TEAL),
        (247, 45, "Benefícios", ["Edições", "Ofertas", "Carteira derivada", "QR, resgate e recibo"], ORANGE_PALE, ORANGE),
    ]
    for x, y, title, items, fill, stroke in groups:
        d.add(Rect(x, y, 143, 84, rx=8, ry=8, fillColor=fill, strokeColor=stroke, strokeWidth=0.9))
        d.add(String(x + 10, y + 65, title, fontName="Noto-Bold", fontSize=8, fillColor=NAVY))
        for i, item in enumerate(items):
            d.add(Circle(x + 12, y + 51 - i * 12, 1.5, fillColor=stroke, strokeColor=stroke))
            d.add(String(x + 18, y + 48.5 - i * 12, item, fontName="Noto", fontSize=6, fillColor=INK))
    return d


def use_case_overview():
    d = Drawing(CONTENT_W, 315)
    d.add(Rect(90, 10, CONTENT_W - 180, 290, rx=10, ry=10, fillColor=SURFACE, strokeColor=LINE))
    actors = [(22, 250, "Visitante"), (22, 155, "Consumidor"), (22, 60, "Parceiro"), (CONTENT_W - 22, 215, "Moderador"), (CONTENT_W - 22, 95, "Administrador")]
    for x, y, label in actors:
        d.add(Circle(x, y + 15, 7, fillColor=ORANGE_PALE, strokeColor=ORANGE))
        d.add(Line(x, y + 8, x, y - 9, strokeColor=NAVY))
        d.add(Line(x - 8, y + 1, x + 8, y + 1, strokeColor=NAVY))
        d.add(Line(x, y - 9, x - 7, y - 21, strokeColor=NAVY))
        d.add(Line(x, y - 9, x + 7, y - 21, strokeColor=NAVY))
        d.add(String(x, y - 32, label, fontName="Noto-Bold", fontSize=6.2, textAnchor="middle", fillColor=NAVY))
    cases = [
        (120, 250, "Explorar catálogo"), (265, 250, "Buscar e filtrar"),
        (120, 200, "Consultar unidade"), (265, 200, "Gerir carteira"),
        (120, 150, "Apresentar benefício"), (265, 150, "Validar e resgatar"),
        (120, 100, "Gerir organização"), (265, 100, "Gerir unidade e oferta"),
        (120, 50, "Submeter conteúdo"), (265, 50, "Moderar e publicar"),
    ]
    for x, y, label in cases:
        d.add(Rect(x - 52, y - 13, 104, 26, rx=13, ry=13, fillColor=WHITE, strokeColor=BLUE, strokeWidth=0.7))
        d.add(String(x, y - 2, label, fontName="Noto", fontSize=6.2, textAnchor="middle", fillColor=INK))
    for x1, y1, x2, y2 in [
        (35, 250, 68, 250), (35, 250, 213, 250), (35, 250, 68, 200),
        (35, 155, 213, 200), (35, 155, 68, 150),
        (35, 60, 68, 100), (35, 60, 213, 100), (35, 60, 213, 150), (35, 60, 68, 50),
        (CONTENT_W - 35, 215, 317, 50), (CONTENT_W - 35, 95, 317, 50), (CONTENT_W - 35, 95, 317, 150),
    ]:
        d.add(Line(x1, y1, x2, y2, strokeColor=HexColor("#98A2B3"), strokeWidth=0.55))
    return d


def process_flow(steps: Sequence[tuple[str, str]], height=130):
    d = Drawing(CONTENT_W, height)
    gap = 9
    w = (CONTENT_W - 24 - gap * (len(steps) - 1)) / len(steps)
    y, h = 32, 62
    palette = [(ORANGE_PALE, ORANGE), (BLUE_PALE, BLUE), (PURPLE_PALE, PURPLE), (TEAL_PALE, TEAL)]
    for i, (title, subtitle) in enumerate(steps):
        x = 12 + i * (w + gap)
        fill, stroke = palette[i % len(palette)]
        box(d, x, y, w, h, title, subtitle, fill=fill, stroke=stroke)
        if i < len(steps) - 1:
            arrow(d, x + w + 1, y + h / 2, x + w + gap - 1, y + h / 2, color=MUTED)
    return d


def domain_map():
    d = Drawing(CONTENT_W, 300)
    items = [
        (190, 220, 100, 46, "Tenant", "operação isolada", NAVY, HexColor("#EEF2FF")),
        (35, 145, 115, 54, "Geografia", "regiões | cidades | timezone", TEAL, TEAL_PALE),
        (180, 145, 115, 54, "Organizações", "identidade legal | membros", BLUE, BLUE_PALE),
        (325, 145, 115, 54, "Taxonomia", "famílias | categorias | atributos", PURPLE, PURPLE_PALE),
        (105, 65, 125, 54, "Estabelecimentos", "identidade estável | revisões", ORANGE, ORANGE_PALE),
        (260, 65, 110, 54, "Benefícios", "edições | ofertas | acessos", AMBER, HexColor("#FFFBEB")),
        (385, 65, 80, 54, "Analytics", "eventos | agregados", TEAL, TEAL_PALE),
        (20, 5, 100, 42, "Mídia", "assets | composição", BLUE, BLUE_PALE),
        (145, 5, 100, 42, "Catálogo", "projeção pública", GREEN, HexColor("#F0FDF4")),
        (270, 5, 100, 42, "Resgates", "recibos imutáveis", RED, HexColor("#FEF2F2")),
    ]
    for x, y, w, h, title, subtitle, stroke, fill in items:
        box(d, x, y, w, h, title, subtitle, fill=fill, stroke=stroke)
    links = [
        (240, 220, 92, 199), (240, 220, 237, 199), (240, 220, 382, 199),
        (237, 145, 168, 119), (382, 145, 168, 119), (168, 65, 70, 47),
        (168, 65, 195, 47), (315, 65, 320, 47), (425, 65, 425, 47),
        (237, 145, 315, 119),
    ]
    for x1, y1, x2, y2 in links:
        arrow(d, x1, y1, x2, y2, color=MUTED, width=0.7)
    return d


def erd_diagram(title: str, entities: Sequence[tuple[str, Sequence[str], float, float]], relations: Sequence[tuple[int, int, str]]):
    d = Drawing(CONTENT_W, 330)
    d.add(String(8, 313, title, fontName="Noto-Bold", fontSize=9, fillColor=NAVY))
    boxes = []
    for name, fields, x, y in entities:
        w = 128
        h = 22 + min(7, len(fields)) * 12
        d.add(Rect(x, y, w, h, rx=5, ry=5, fillColor=WHITE, strokeColor=BLUE, strokeWidth=0.8))
        d.add(Rect(x, y + h - 20, w, 20, rx=5, ry=5, fillColor=NAVY, strokeColor=NAVY))
        d.add(String(x + 7, y + h - 14, name, fontName="Noto-Bold", fontSize=6.8, fillColor=WHITE))
        for i, field in enumerate(fields[:7]):
            d.add(String(x + 7, y + h - 33 - i * 11, field, fontName="NotoMono", fontSize=5.2, fillColor=INK))
        boxes.append((x, y, w, h))
    for left_idx, right_idx, label in relations:
        lx, ly, lw, lh = boxes[left_idx]
        rx, ry, rw, rh = boxes[right_idx]
        x1 = lx + lw / 2
        y1 = ly + lh / 2
        x2 = rx + rw / 2
        y2 = ry + rh / 2
        if abs(x2 - x1) > abs(y2 - y1):
            x1 = lx + (lw if x2 > x1 else 0)
            x2 = rx + (0 if x2 > x1 else rw)
        else:
            y1 = ly + (lh if y2 > y1 else 0)
            y2 = ry + (0 if y2 > y1 else rh)
        d.add(Line(x1, y1, x2, y2, strokeColor=MUTED, strokeWidth=0.7))
        d.add(String((x1 + x2) / 2, (y1 + y2) / 2 + 3, label, fontName="Noto", fontSize=5.2, textAnchor="middle", fillColor=ORANGE_DARK))
    return d


def state_machine(title: str, states: Sequence[str], transitions: Sequence[str]):
    d = Drawing(CONTENT_W, 120)
    d.add(String(8, 104, title, fontName="Noto-Bold", fontSize=8.5, fillColor=NAVY))
    gap = 10
    w = (CONTENT_W - 24 - gap * (len(states) - 1)) / len(states)
    for i, state in enumerate(states):
        x = 12 + i * (w + gap)
        fill = ORANGE_PALE if i in (0, len(states) - 1) else BLUE_PALE
        stroke = ORANGE if i in (0, len(states) - 1) else BLUE
        d.add(Rect(x, 43, w, 31, rx=15, ry=15, fillColor=fill, strokeColor=stroke, strokeWidth=0.8))
        d.add(String(x + w / 2, 55, state, fontName="Noto-Bold", fontSize=5.8, textAnchor="middle", fillColor=NAVY))
        if i < len(states) - 1:
            arrow(d, x + w + 1, 58, x + w + gap - 1, 58, color=MUTED)
            if i < len(transitions):
                d.add(String(x + w + gap / 2, 78, transitions[i], fontName="Noto", fontSize=4.7, textAnchor="middle", fillColor=MUTED))
    return d


def use_case_card(uc: dict):
    rows = [
        ("Objetivo", uc["objective"]),
        ("Atores", uc["actors"]),
        ("Pré-condições", uc["pre"]),
        ("Fluxo principal", "<br/>".join(f"{i + 1}. {step}" for i, step in enumerate(uc["flow"]))),
        ("Exceções", uc["exceptions"]),
        ("Pós-condições", uc["post"]),
        ("Regras relacionadas", uc["rules"]),
    ]
    title = Table([[P(uc["id"], "table_head"), P(uc["name"], "table_head")]], colWidths=[25 * mm, CONTENT_W - 25 * mm])
    title.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("BOX", (0, 0), (-1, -1), 0.5, NAVY),
        ("LEFTPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2.5 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2 * mm),
    ]))
    body = Table([[P(k, "table_cell_bold"), P(v, "table_cell")] for k, v in rows], colWidths=[32 * mm, CONTENT_W - 32 * mm])
    body.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
        ("BACKGROUND", (0, 0), (0, -1), SURFACE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 2.2 * mm),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2.2 * mm),
        ("TOPPADDING", (0, 0), (-1, -1), 1.4 * mm),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.4 * mm),
    ]))
    return KeepTogether([title, body, Spacer(1, 4 * mm)])


BUSINESS_REQUIREMENTS = [
    ("RN-01", "Catálogo sem login", "A descoberta pública deve funcionar sem autenticação ou membership."),
    ("RN-02", "Multicidade", "Cidade é dimensão de descoberta; uma operação pode servir várias cidades."),
    ("RN-03", "Multicategoria", "A taxonomia deve suportar gastronomia, lazer, cultura, bem-estar e serviços."),
    ("RN-04", "Tenant como operação", "Tenant isola uma operação da plataforma; não representa cidade nem organização."),
    ("RN-05", "Organização distinta de unidade", "Uma organização pode administrar múltiplos estabelecimentos em cidades diferentes."),
    ("RN-06", "Membership organizacional", "Owner, admin, editor e analyst pertencem ao contexto da organização."),
    ("RN-07", "Conteúdo revisionado", "Alterações de conteúdo público devem ocorrer em revisão separada da publicação corrente."),
    ("RN-08", "Publicação moderada", "Somente revisão completa, revisada e aprovada pode se tornar pública."),
    ("RN-09", "Completude versionada", "Gates produzem score, blockers, warnings, timestamp e versão das regras."),
    ("RN-10", "Mídia moderada", "Somente mídia aprovada, com texto alternativo e exatamente uma capa, compõe o catálogo."),
    ("RN-11", "Busca regional", "Busca deve combinar texto, tolerância a erro, categoria, cidade, abertura e paginação determinística."),
    ("RN-12", "Conversão externa segura", "Rotas, WhatsApp, telefone e site usam destinos permitidos e nunca open redirect."),
    ("RN-13", "Analytics privado", "Eventos não armazenam IP ou user-agent bruto e respeitam DNT e GPC."),
    ("RN-14", "Benefícios opcionais", "Benefícios não condicionam a presença no catálogo nem compram ranking orgânico."),
    ("RN-15", "Edição por cidade", "Cada edição de benefício pertence a uma cidade ativa da operação."),
    ("RN-16", "Oferta por unidade", "Oferta pertence a uma edição e a uma unidade publicada da mesma cidade."),
    ("RN-17", "Acesso como entitlement", "Acesso habilita uma edição; a carteira deriva suas ofertas ativas dinamicamente."),
    ("RN-18", "Apresentação temporária", "Código de apresentação é assinado, expira em cinco minutos e não confirma consumo."),
    ("RN-19", "Resgate revalidado", "O servidor revalida titular, parceiro, estado, janela, cidade e limite no momento do resgate."),
    ("RN-20", "Comprovante imutável", "Cada resgate preserva snapshots dos termos e gera código permanente para ambas as partes."),
    ("RN-21", "Histórico preservado", "Arquivamento, revogação ou rejeição não apagam evidência histórica relevante."),
    ("RN-22", "Onboarding derivado", "O progresso do parceiro é calculado a partir dos agregados canônicos, sem checklist paralelo."),
    ("RN-23", "Feedback do piloto", "Usuários do piloto podem registrar feedback contextualizado e a operação pode tratá-lo."),
    ("RN-24", "Evolução guiada por evidência", "Novos cortes comerciais dependem da validação do piloto e de backlog priorizado."),
]


USE_CASES = [
    dict(id="UC-01", name="Explorar catálogo regional", objective="Permitir que qualquer visitante descubra cidades, categorias e unidades publicadas.", actors="Visitante ou consumidor", pre="Hostname resolve uma operação pública ativa.", flow=["Abrir a seleção de cidades", "Escolher uma cidade ativa", "Navegar por categorias ou resultados", "Abrir a página pública de uma unidade"], exceptions="Cidade inativa, operação desconhecida ou unidade não publicável resultam em recurso não encontrado.", post="Somente projeções públicas permitidas são exibidas.", rules="RN-01, RN-02, RN-03, RN-04, RN-08, RN-10"),
    dict(id="UC-02", name="Buscar e filtrar unidades", objective="Localizar unidades por intenção, nome, categoria e disponibilidade.", actors="Visitante ou consumidor", pre="Cidade ativa e catálogo projetado.", flow=["Informar termo opcional", "Aplicar categoria e filtro aberto agora", "Selecionar ordenação", "Paginar resultados patrocinados identificados e orgânicos"], exceptions="Termos inválidos são rejeitados; ausência de resultados pode gerar evento analítico privado.", post="Resultado determinístico, tenant-scoped e cacheável.", rules="RN-11, RN-13, RN-14"),
    dict(id="UC-03", name="Criar ou reivindicar organização", objective="Estabelecer a entidade legal/comercial responsável pelas unidades.", actors="Parceiro e administrador", pre="Usuário autenticado na operação.", flow=["Criar organização ou solicitar claim", "Validar CNPJ, identidade e contato", "Administrador analisa a solicitação", "Aprovação cria membership owner quando aplicável"], exceptions="CNPJ duplicado, claim concorrente ou organização não reivindicável bloqueiam o fluxo.", post="Organização com estado auditável e owner ativo.", rules="RN-05, RN-06, RN-21"),
    dict(id="UC-04", name="Gerir equipe da organização", objective="Delegar acesso sem criar papéis globais de parceiro.", actors="Owner ou admin da organização", pre="Membership ativa com capacidade de gestão.", flow=["Convidar usuário por e-mail", "Entregar token de uso único", "Usuário autenticado aceita convite", "Membership é criada ou reativada"], exceptions="E-mail divergente, token expirado e remoção do último owner são bloqueados.", post="Equipe atualizada, preservando isolamento e auditoria.", rules="RN-06, RN-21"),
    dict(id="UC-05", name="Cadastrar e editar unidade", objective="Construir uma ficha pública estruturada para um estabelecimento.", actors="Owner, admin ou editor", pre="Organização acessível e em estado que permita gestão.", flow=["Criar identidade estável e revisão draft", "Preencher identidade, endereço e coordenadas", "Selecionar categorias e atributos", "Cadastrar horários, contatos e mídia"], exceptions="Cidade estrangeira, categorias inválidas, atributos mal tipados ou horários sobrepostos são rejeitados.", post="Revisão editável e score de completude recalculável.", rules="RN-05, RN-07, RN-09, RN-10"),
    dict(id="UC-06", name="Submeter unidade para análise", objective="Congelar uma revisão completa para moderação.", actors="Parceiro autorizado", pre="Revisão draft ou changes_requested e unidade ativa.", flow=["Consultar diagnóstico de completude", "Corrigir blockers", "Solicitar submissão", "Servidor revalida em transação e muda para pending_review"], exceptions="Blockers mantêm a revisão editável; mídia pendente pode passar na submissão, mas não na publicação.", post="Revisão congelada e evento de submissão registrado.", rules="RN-07, RN-08, RN-09, RN-10"),
    dict(id="UC-07", name="Moderar e publicar revisão", objective="Garantir qualidade e trocar a publicação de forma atômica.", actors="Moderador ou administrador", pre="Revisão pending_review na operação correta.", flow=["Abrir fila tenant-scoped", "Inspecionar agregado e mídia", "Aprovar, rejeitar ou solicitar correções", "Na aprovação, revalidar gate e trocar published_revision_id"], exceptions="Issues blocking, mídia pendente/quarentenada ou estado concorrente impedem publicação.", post="Nova revisão pública ou histórico de decisão preservado; projeção atualizada.", rules="RN-07, RN-08, RN-09, RN-10, RN-21"),
    dict(id="UC-08", name="Consultar analytics da organização", objective="Apresentar resultados de descoberta sem identificar visitantes.", actors="Owner, admin, analyst ou administrador da operação", pre="Organização acessível e intervalo válido.", flow=["Escolher período e unidade opcional", "Ler impressões, visualizações e conversões", "Examinar série diária e unidades", "Operação analisa buscas sem resultado"], exceptions="Intervalos futuros ou superiores a 366 dias são rejeitados; escopo estrangeiro retorna not found.", post="Dashboard privado com agregados autorizados.", rules="RN-12, RN-13"),
    dict(id="UC-09", name="Configurar edição e oferta", objective="Organizar uma campanha de benefícios por cidade.", actors="Administrador da operação e parceiro", pre="Cidade ativa; unidade publicada para ofertas.", flow=["Administrador cria edição", "Parceiro cria oferta para unidade da mesma cidade", "Parceiro ativa a oferta", "Administrador publica a edição com oferta ativa"], exceptions="Edição arquivada, cidade divergente ou unidade fechada impedem ativação.", post="Edição publicada com ofertas elegíveis.", rules="RN-14, RN-15, RN-16"),
    dict(id="UC-10", name="Conceder acesso e montar carteira", objective="Habilitar uma edição para um consumidor sem materializar cada oferta.", actors="Administrador da operação e consumidor", pre="Edição publicada ou pausada e usuário pertencente à operação.", flow=["Administrador concede acesso", "Sistema impede acesso ativo duplicado", "Consumidor abre a carteira", "Sistema deriva passes, ofertas, estados e usos restantes"], exceptions="Edição expirada, holder estrangeiro e referência de pagamento duplicada são rejeitados.", post="Entitlement ativo e carteira privada atualizada.", rules="RN-17, RN-21"),
    dict(id="UC-11", name="Apresentar e resgatar benefício", objective="Confirmar uso presencial com autorização bilateral e evidência permanente.", actors="Consumidor e parceiro", pre="Acesso, edição, oferta e unidade disponíveis.", flow=["Consumidor gera QR temporário", "Parceiro abre o link e confere titular e regras", "Parceiro confirma", "Servidor bloqueia registros, revalida e cria resgate", "Ambos consultam o mesmo comprovante"], exceptions="Token adulterado/expirado, replay, parceiro estrangeiro, janela inválida ou limite atingido bloqueiam o resgate.", post="Resgate único, auditável, com snapshots e recibo permanente.", rules="RN-18, RN-19, RN-20, RN-21"),
    dict(id="UC-12", name="Registrar feedback do piloto", objective="Converter fricções reais em backlog priorizado.", actors="Parceiro, consumidor e administrador", pre="Usuário autenticado e alvo acessível quando informado.", flow=["Selecionar contexto e nota", "Descrever problema ou aprendizado", "Sistema valida vínculo com organização/unidade", "Operação classifica, resolve ou descarta"], exceptions="Alvo fora do escopo ou contexto sem alvo obrigatório é rejeitado.", post="Feedback rastreável e utilizável na priorização.", rules="RN-23, RN-24"),
]


SCHEMA_GROUPS = [
    ("Identidade, acesso e operação", [
        ("users", "Contas e identidade; soft delete e verificação.", "id", "email e username únicos; senha Argon2; PII tombstonada na exclusão."),
        ("tenants", "Operações isoladas da plataforma.", "id", "slug único; estado ativo."),
        ("user_tenants", "Membership N:N entre usuário e operação.", "user_id + tenant_id", "FK composta usada por acessos e resgates."),
        ("roles", "Papéis globais de RBAC.", "id", "slug único e hierarquia."),
        ("permissions", "Capacidades resource.action.context.", "id", "nome único e contexto controlado."),
        ("user_roles", "Atribuição direta de papéis.", "user_id + role_id", "Integridade relacional."),
        ("role_permissions", "Permissões herdadas por papel.", "role_id + permission_id", "Sem duplicidade."),
        ("user_permissions", "Permissões diretas por usuário.", "user_id + permission_id", "Complementa papéis."),
        ("auth_access_tokens", "Tokens persistidos pelo guard quando aplicável.", "id", "hash e expiração."),
        ("auth_refresh_tokens", "Refresh tokens opacos rotativos.", "id", "hash único, revogação, rotação e família."),
        ("password_reset_tokens", "Reset de senha de uso único.", "id", "hash HMAC, expiração e consumo."),
        ("rate_limits", "Contadores de limitação de requisições.", "key", "expiração controlada."),
    ]),
    ("Geografia e taxonomia", [
        ("regions", "Agrupamentos regionais da operação.", "id", "tenant_id obrigatório; slug tenant-scoped."),
        ("cities", "Cidades de descoberta com timezone e coordenadas.", "id", "FK composta para região; IBGE e slug consistentes."),
        ("category_families", "Famílias de categorias.", "id", "tenant-scoped, estado ativo e ordenação."),
        ("categories", "Árvore hierárquica de categorias.", "id", "máximo de dois níveis; pai na mesma família e tenant."),
        ("category_attribute_definitions", "Definições tipadas herdáveis.", "id", "key única por tenant; tipo, obrigatoriedade e visibilidade."),
        ("category_attribute_options", "Opções para select/multiselect.", "id", "definition e tenant coerentes; value única."),
    ]),
    ("Organizações e unidades", [
        ("organizations", "Identidade legal/comercial do parceiro.", "id", "CNPJ normalizado único por tenant; máquina de estados."),
        ("organization_members", "Papéis internos owner/admin/editor/analyst.", "id", "membership única e último owner protegido no serviço."),
        ("organization_claims", "Solicitações auditáveis de propriedade.", "id", "um claim pendente por usuário e organização."),
        ("organization_invitations", "Convites com token HMAC.", "id", "e-mail, role, expiração, revogação e consumo."),
        ("establishments", "Identidade pública estável da unidade.", "id", "organization_id, lifecycle, business_status, published_revision_id."),
        ("establishment_revisions", "Snapshots editáveis e publicáveis.", "id", "version única; uma revisão aberta por unidade; slug cidade-scoped."),
        ("establishment_revision_addresses", "Endereço e geolocalização por revisão.", "revision_id", "um endereço por revisão; ranges de latitude/longitude."),
        ("establishment_revision_categories", "Categorias e primária por revisão.", "revision_id + category_id", "uma primária; integridade cross-tenant."),
        ("establishment_revision_attribute_values", "Valores escalares tipados.", "id", "um valor por definição; apenas coluna compatível preenchida."),
        ("establishment_revision_attribute_value_options", "Opções selecionadas.", "attribute_value_id + option_id", "definition coerente."),
        ("establishment_revision_hours", "Intervalos semanais.", "id", "weekday 0-6; overnight explícito; ordem única."),
        ("establishment_revision_special_days", "Exceções por data.", "id", "closed ou custom_hours; data única por revisão."),
        ("establishment_revision_special_hours", "Intervalos de dias especiais.", "id", "ligação consistente a special_day e revisão."),
        ("establishment_revision_events", "Histórico append-only de transições.", "id", "ator, status anterior/novo, motivo e metadata."),
        ("establishment_revision_review_issues", "Pendências estruturadas de moderação.", "id", "code+field único enquanto aberto; severidade."),
    ]),
    ("Arquivos, mídia e catálogo", [
        ("files", "Objetos armazenados e metadados de upload.", "id", "owner, tenant, tipo, tamanho, URL e chave."),
        ("media_assets", "Asset estável ligado à unidade.", "id", "checksum SHA-256, MIME, dimensão e arquivo."),
        ("establishment_revision_media", "Composição de mídia por revisão.", "id", "cover única, ordem, alt text e estado de moderação."),
        ("media_moderation_events", "Evidência append-only de decisões de mídia.", "id", "from/to status, ator, motivo e metadata."),
        ("catalog_tenant_versions", "Versão monotônica da projeção por operação.", "tenant_id", "invalida chaves de cache sem scans."),
        ("catalog_establishments", "Documento público denormalizado por unidade.", "establishment_id", "JSONB, FTS, trigram, status público e versão."),
        ("catalog_establishment_categories", "Índice relacional para filtros hierárquicos.", "tenant_id + establishment_id + category_id", "família/categoria e flags projetadas."),
    ]),
    ("Analytics, benefícios e operação", [
        ("analytics_events", "Eventos brutos pseudônimos e idempotentes.", "id", "event_id/dedupe_key únicos; sem IP/UA bruto; expiração."),
        ("analytics_daily_metrics", "Agregados diários por evento e unidade.", "id", "contagem e sessões únicas com retenção."),
        ("analytics_daily_metric_sessions", "Contribuições únicas por sessão ao agregado.", "chave composta", "evita inflar unique_sessions."),
        ("analytics_daily_search_terms", "Buscas sem resultado redigidas.", "id", "hash HMAC, termo sanitizado e categoria."),
        ("analytics_daily_search_sessions", "Sessões únicas por termo/dia.", "chave composta", "dedupe de visitantes pseudônimos."),
        ("benefit_editions", "Campanhas por cidade e janela de uso.", "id", "slug tenant-scoped; draft/published/paused/archived."),
        ("benefit_offers", "Mecânica oferecida por uma unidade.", "id", "uma oferta por edição/unidade; valores tipados e janela."),
        ("benefit_accesses", "Entitlement de usuário a edição.", "id", "um acesso ativo; referência externa idempotente; revogação."),
        ("benefit_redemptions", "Uso confirmado e comprovante imutável.", "id", "nonce e recibo únicos; número por acesso/oferta; snapshots."),
        ("pilot_feedback", "Feedback contextual do piloto.", "id", "rating 1-5; alvo tenant-scoped; revisão administrativa."),
        ("audit_logs", "Trilha transversal de autorização e operações.", "id", "ator, recurso, ação, resultado e contexto."),
    ]),
]


def build_story():
    story = [CoverContent(), NextPageTemplate("Body"), PageBreak()]

    story += [
        H1("Sobre este documento"),
        P("Este documento consolida a visão de produto, os requisitos de negócio, os casos de uso, os contratos arquiteturais e o modelo de dados implementado no repositório Experimente+. Ele representa a baseline funcional EP-11 e serve como referência compartilhada para produto, engenharia, operação, parceiros e validação do piloto."),
        callout("Fonte de verdade", "Decisões de produto são governadas por <b>docs/product</b>; contratos estruturais por <b>docs/architecture/decisions</b>; o schema canônico pré-1.0 é definido pelas migrations originais. Em caso de divergência, ADRs aceitos e implementação validada prevalecem sobre textos introdutórios antigos."),
        Spacer(1, 4 * mm),
        styled_table(
            ["Campo", "Valor"],
            [
                ("Documento", "Documentação de Negócio e Dados"),
                ("Produto", "Experimente+"),
                ("Versão", "1.0"),
                ("Baseline", "EP-00 a EP-11 implementados e validados"),
                ("Data de referência", "31 de agosto de 2026"),
                ("Escopo", "Catálogo, parceiros, moderação, analytics, benefícios, carteira e resgate"),
                ("Estado", "Pronto para validação operacional assistida"),
            ],
            widths=[42 * mm, CONTENT_W - 42 * mm],
            repeat=False,
        ),
        Spacer(1, 7 * mm),
        H1("Sumário"),
    ]
    toc = TableOfContents()
    toc.levelStyles = [S["toc1"], S["toc2"]]
    story += [toc, PageBreak()]

    story += [SectionDivider("01", "Visão de negócio", "Posicionamento, escopo, atores, capacidades e requisitos que orientam a solução."), Spacer(1, 8 * mm)]
    story += [
        H1("1. Visão executiva"),
        P("O Experimente+ é uma plataforma regional de descoberta para ajudar pessoas a decidir onde comer, o que fazer e quais serviços locais conhecer. Restaurantes, bares e cafés são a primeira vertical comercial, mas a plataforma foi concebida para operar com categorias extensíveis como lazer, cultura, tatuagem, beleza, bem-estar e outros serviços."),
        metric_cards([("3", "cidades no cenário piloto"), ("21", "ADRs aceitos"), ("51", "estruturas persistentes"), ("EP-11", "baseline funcional")]),
        Spacer(1, 5 * mm),
        H2("1.1 Proposta de valor"),
        styled_table(
            ["Público", "Problema", "Valor entregue"],
            [
                ("Visitante", "Informação local dispersa e pouco estruturada.", "Descoberta gratuita por cidade, categoria, intenção e disponibilidade."),
                ("Parceiro", "Baixa autonomia sobre presença digital e conteúdo.", "Gestão de organização, unidades, mídia, ofertas e resultados."),
                ("Operação", "Curadoria manual sem rastreabilidade.", "Backoffice, gates, moderação, auditoria e feedback do piloto."),
                ("Consumidor com acesso", "Benefícios difíceis de compreender e validar.", "Carteira clara, QR temporário e comprovante permanente."),
            ],
            widths=[28 * mm, 63 * mm, CONTENT_W - 91 * mm],
        ),
        H2("1.2 Camadas evolutivas"),
        process_flow([
            ("Catálogo", "descoberta gratuita|sem login"),
            ("Parceiros", "presença|conteúdo|resultados"),
            ("Pro", "assinatura B2B|futuro"),
            ("Pass", "benefícios|acesso|resgate"),
        ]),
        P("Figura 1 - Evolução comercial sem condicionar o catálogo gratuito.", "caption"),
        callout("Limite atual", "Checkout, cobrança, conciliação financeira, reservas internas, avaliações públicas e Concierge IA não fazem parte da baseline EP-11. Sua entrada depende de evidência operacional.", color=AMBER, background=HexColor("#FFFBEB")),
    ]

    story += [
        H1("2. Princípios de domínio"),
        styled_table(
            ["Princípio", "Implicação"],
            [
                ("Cidade não é tenant", "Cidade organiza descoberta; tenant isola uma operação da plataforma."),
                ("Organização não é unidade", "A entidade legal/comercial pode possuir várias unidades em diferentes cidades."),
                ("Parceiro não é papel global", "A capacidade decorre de membership owner/admin/editor/analyst na organização."),
                ("Publicação é explícita", "Drafts nunca alteram silenciosamente a revisão publicada."),
                ("Busca lê projeção", "O catálogo consulta uma projeção reconstruível, não o agregado de escrita."),
                ("Benefício é opcional", "A presença pública não depende de voucher, compra ou assinatura."),
                ("Histórico é evidência", "Rejeições, revogações, eventos e resgates são preservados."),
                ("Privacidade por padrão", "Analytics evita identificadores brutos e respeita sinais do navegador."),
            ],
            widths=[48 * mm, CONTENT_W - 48 * mm],
        ),
        H2("2.1 Mapa de capacidades"),
        capability_map(),
        P("Figura 2 - Capacidades atuais organizadas por objetivo de negócio.", "caption"),
    ]

    story += [
        H1("3. Atores e responsabilidades"),
        styled_table(
            ["Ator", "Responsabilidades", "Limites"],
            [
                ("Visitante", "Explorar cidades, categorias, busca e páginas públicas.", "Não necessita login nem membership."),
                ("Consumidor", "Consultar carteira, apresentar benefícios e ver comprovantes.", "Só acessa seus próprios entitlements e resgates."),
                ("Owner", "Responsabilidade máxima pela organização e equipe.", "Último owner ativo não pode ser removido ou rebaixado."),
                ("Admin da organização", "Gerir equipe, unidades, conteúdo e ofertas.", "Não controla configuração global da operação."),
                ("Editor", "Editar unidades, mídia e ofertas autorizadas.", "Não administra owners nem ações de alto risco."),
                ("Analyst", "Ler analytics da organização.", "Não altera conteúdo operacional."),
                ("Moderador", "Revisar mídia e conteúdo submetido.", "Age somente na operação ativa e registra decisão."),
                ("Administrador da operação", "Configurar domínios, publicar edições, conceder acessos e tratar feedback.", "Ainda sujeito a tenant scope, invariantes e auditoria."),
            ],
            widths=[31 * mm, 74 * mm, CONTENT_W - 105 * mm],
        ),
        H2("3.1 Visão de casos de uso"),
        use_case_overview(),
        P("Figura 3 - Relação de alto nível entre atores e jornadas principais.", "caption"),
    ]

    story += [H1("4. Requisitos de negócio")]
    story.append(styled_table(["ID", "Requisito", "Definição verificável"], BUSINESS_REQUIREMENTS, widths=[18 * mm, 42 * mm, CONTENT_W - 60 * mm]))

    story += [PageBreak(), SectionDivider("02", "Casos de uso e regras", "Fluxos ponta a ponta, exceções, pós-condições e máquinas de estado."), Spacer(1, 8 * mm)]
    story += [H1("5. Catálogo de casos de uso"), P("Os casos abaixo descrevem comportamento de negócio. Endpoints, páginas e detalhes de implementação podem evoluir desde que as pré-condições, invariantes e pós-condições permaneçam atendidas.")]
    for uc in USE_CASES:
        story.append(use_case_card(uc))

    story += [
        H1("6. Jornadas ponta a ponta"),
        H2("6.1 Publicação de uma unidade"),
        process_flow([
            ("Draft", "parceiro edita|agregado completo"),
            ("Submissão", "gate de completude|freeze"),
            ("Moderação", "issues|mídia|decisão"),
            ("Publicação", "swap do ponteiro|projeção"),
        ], 145),
        P("Figura 4 - Drafts permanecem privados; a publicação ocorre somente após revalidação transacional.", "caption"),
        H2("6.2 Apresentação e resgate"),
        process_flow([
            ("Carteira", "oferta derivada|uso restante"),
            ("QR", "HMAC|TTL 5 min|nonce"),
            ("Prévia", "parceiro confere|titular e regras"),
            ("Resgate", "locks|revalidação|recibo"),
        ], 145),
        P("Figura 5 - O QR apresenta intenção; somente a confirmação do parceiro cria o resgate.", "caption"),
        H2("6.3 Descoberta e analytics"),
        process_flow([
            ("Descoberta", "SSR/API|sem login"),
            ("Ação", "evento allowlisted|DNT/GPC"),
            ("Agregação", "HMAC session|dedupe"),
            ("Dashboard", "escopo da org|retenção"),
        ], 145),
        P("Figura 6 - Eventos são minimizados e agregados sem armazenar IP ou user-agent bruto.", "caption"),
    ]

    story += [
        H1("7. Máquinas de estado"),
        state_machine("Organização", ["draft", "pending_review", "active", "suspended", "archived"], ["submit", "approve", "suspend", "archive"]),
        P("Figura 7 - Ciclo de vida da organização; changes_requested retorna ao fluxo editável.", "caption"),
        state_machine("Revisão de estabelecimento", ["draft", "pending_review", "changes_requested", "approved / rejected"], ["submit", "request changes", "resubmit / decide"]),
        P("Figura 8 - Uma unidade mantém no máximo uma revisão aberta; approved/rejected são terminais.", "caption"),
        state_machine("Edição de benefício", ["draft", "published", "paused", "archived"], ["publish", "pause", "archive"]),
        P("Figura 9 - Edições publicadas precisam de pelo menos uma oferta ativa.", "caption"),
        state_machine("Oferta de benefício", ["draft", "active", "paused", "archived"], ["activate", "pause", "archive"]),
        P("Figura 10 - Ofertas ativas devem ser pausadas antes de edição ou arquivamento.", "caption"),
    ]

    story += [PageBreak(), SectionDivider("03", "Arquitetura e modelo de dados", "Limites de domínio, componentes, relacionamentos, schemas e garantias de integridade."), Spacer(1, 8 * mm)]
    story += [
        H1("8. Arquitetura da solução"),
        P("A aplicação é um monólito modular em AdonisJS 7 com React 19 e Inertia SSR. Cada domínio concentra controllers, services, repositories, models, validators, interfaces e rotas. O PostgreSQL é simultaneamente store transacional e motor da projeção pública; Redis oferece cache, limiter e infraestrutura de filas; arquivos usam um disk abstrato compatível com filesystem e object storage."),
        architecture_diagram(),
        P("Figura 11 - Arquitetura em camadas e dependências principais.", "caption"),
        H2("8.1 Padrões arquiteturais"),
        styled_table(
            ["Padrão", "Aplicação"],
            [
                ("Monólito modular", "Limites por domínio em app/modules, com infraestrutura transversal em app/shared."),
                ("Service + repository", "Services coordenam regras e transações; repositories encapsulam persistência."),
                ("Policy de domínio", "RBAC concede capacidade geral e a policy valida membership, estado e ownership."),
                ("Snapshot versionado", "Conteúdo público vive em revisions; o agregado estável aponta para a revisão publicada."),
                ("Outbox implícito no banco", "Triggers síncronos mantêm a projeção do catálogo coerente com a transação."),
                ("Read model", "Catálogo, carteira e dashboards são projeções adequadas ao consumidor."),
                ("Append-only evidence", "Eventos de revisão, moderação, analytics bruto e resgates preservam evidência."),
                ("Defense in depth", "Validação, service, policy, transação, FK composta, índices parciais e CHECKs se complementam."),
            ],
            widths=[48 * mm, CONTENT_W - 48 * mm],
        ),
    ]

    story += [
        H1("9. Mapa de domínios"),
        domain_map(),
        P("Figura 12 - Tenant envolve os domínios operacionais; cidade e categoria permanecem dimensões de descoberta.", "caption"),
        H2("9.1 Dependências permitidas"),
        *bullet_list([
            "Catálogo depende apenas de projeções públicas, do resolver de operação e de geografia pública.",
            "Organizações autorizam acesso a estabelecimentos, ofertas e analytics por policies de domínio.",
            "Estabelecimentos dependem de geografia, taxonomia, organizações e mídia, mas preservam seu agregado revisionado.",
            "Benefícios referenciam edições, unidades publicadas, acessos e resgates sem alterar a publicação do catálogo.",
            "Analytics resolve alvos a partir do catálogo publicado; eventos inválidos não criam dados parciais.",
        ]),
    ]

    story += [
        H1("10. Diagramas entidade-relacionamento"),
        erd_diagram(
            "10.1 Organização, unidade e publicação",
            [
                ("tenants", ["PK id", "name", "slug", "is_active"], 8, 228),
                ("organizations", ["PK id", "FK tenant_id", "tax_id", "status"], 170, 228),
                ("organization_members", ["PK id", "FK organization_id", "FK user_id", "role", "status"], 332, 228),
                ("establishments", ["PK id", "FK organization_id", "lifecycle_status", "business_status", "published_revision_id"], 86, 92),
                ("establishment_revisions", ["PK id", "FK establishment_id", "version", "status", "city_id", "slug"], 250, 82),
                ("revision children", ["addresses", "categories", "attributes", "hours", "special_days", "media", "review_issues"], 385, 38),
            ],
            [(0, 1, "1:N"), (1, 2, "1:N"), (1, 3, "1:N"), (3, 4, "1:N / published"), (4, 5, "1:N")],
        ),
        P("Figura 13 - A identidade estável da unidade é separada de seus snapshots públicos.", "caption"),
        erd_diagram(
            "10.2 Geografia, taxonomia e conteúdo tipado",
            [
                ("regions", ["PK id", "FK tenant_id", "slug", "is_active"], 8, 230),
                ("cities", ["PK id", "FK region_id", "timezone", "coordinates"], 170, 230),
                ("category_families", ["PK id", "FK tenant_id", "slug", "is_active"], 332, 230),
                ("categories", ["PK id", "FK family_id", "FK parent_id", "slug"], 332, 110),
                ("attribute_definitions", ["PK id", "FK category_id", "data_type", "is_required", "is_public"], 170, 75),
                ("attribute_options", ["PK id", "FK definition_id", "label", "value"], 8, 30),
            ],
            [(0, 1, "1:N"), (2, 3, "1:N"), (3, 4, "1:N + herança"), (4, 5, "1:N")],
        ),
        P("Figura 14 - Atributos são definidos por categoria e herdados pela árvore efetiva.", "caption"),
        erd_diagram(
            "10.3 Benefícios, carteira e resgate",
            [
                ("benefit_editions", ["PK id", "FK tenant_id", "FK city_id", "usage window", "status"], 8, 225),
                ("benefit_offers", ["PK id", "FK edition_id", "FK establishment_id", "benefit_type", "limit", "status"], 170, 210),
                ("benefit_accesses", ["PK id", "FK edition_id", "FK user_id", "source", "status"], 8, 82),
                ("benefit_redemptions", ["PK id", "FK access_id", "FK offer_id", "nonce_hash", "receipt_code", "snapshots"], 250, 70),
                ("establishments", ["PK id", "FK organization_id", "published_revision_id", "business_status"], 332, 225),
            ],
            [(0, 1, "1:N"), (0, 2, "1:N"), (1, 4, "N:1"), (1, 3, "1:N"), (2, 3, "1:N")],
        ),
        P("Figura 15 - A carteira deriva ofertas da edição; resgates preservam snapshots e replay protection.", "caption"),
        erd_diagram(
            "10.4 Catálogo e analytics",
            [
                ("catalog_establishments", ["PK establishment_id", "tenant_id", "published_revision_id", "JSONB projections", "search_vector"], 20, 220),
                ("catalog_categories", ["tenant_id", "establishment_id", "category_id", "family_id"], 190, 220),
                ("analytics_events", ["PK id", "event_id", "dedupe_key", "session_hash", "expires_at"], 340, 210),
                ("daily_metrics", ["metric_date", "event_type", "establishment_id", "event_count", "unique_sessions"], 90, 65),
                ("daily_search_terms", ["metric_date", "city_id", "term_hash", "redacted_term", "counts"], 285, 65),
            ],
            [(0, 1, "1:N"), (0, 2, "resolve alvo"), (2, 3, "agrega"), (2, 4, "no results")],
        ),
        P("Figura 16 - O catálogo é a fonte pública e o analytics agrega eventos minimizados.", "caption"),
    ]

    story += [H1("11. Dicionário de dados")]
    story.append(P("O schema pré-1.0 é otimizado para instalação limpa: mudanças em objetos ainda não publicados são consolidadas nas migrations create_* originais. A referência abaixo descreve as 51 estruturas persistentes e suas garantias principais."))
    for group_name, entries in SCHEMA_GROUPS:
        story += [H2(group_name)]
        story.append(styled_table(["Tabela", "Finalidade", "Chave", "Integridade e regra"], entries, widths=[39 * mm, 52 * mm, 34 * mm, CONTENT_W - 125 * mm]))

    story += [
        H1("12. Schemas críticos em detalhe"),
        H2("12.1 Establishment e revision"),
        styled_table(
            ["Entidade", "Campos de negócio", "Invariantes"],
            [
                ("establishments", "tenant_id, organization_id, lifecycle_status, business_status, published_revision_id, created_by", "PK estável; ponteiro publicado só referencia revisão aprovada da própria unidade e tenant."),
                ("establishment_revisions", "version, status, city_id, public_name, slug, descriptions, contacts, availability_type, based_on_revision_id, timestamps de review", "Version única por unidade; índice parcial garante uma única revisão aberta; slug único por tenant e cidade."),
                ("revision_addresses", "postal_code, street, number, without_number, district, reference, latitude, longitude, coordinate_source", "Uma linha por revisão; coordenadas aparecem em par e respeitam ranges geográficos."),
                ("revision_categories", "category_id, is_primary, sort_order", "Categorias leaf e ativas; exatamente uma primária para completude/publicação."),
                ("revision_attribute_values", "definition_id e uma coluna value_* compatível", "CHECK de formato tipado; selects usam tabela de opções."),
                ("revision_hours", "weekday, opens_at, closes_at, spans_next_day, sort_order", "Serviço valida overlap inclusive no fechamento semanal e travessia da meia-noite."),
            ],
            widths=[40 * mm, 70 * mm, CONTENT_W - 110 * mm],
        ),
        H2("12.2 Benefit redemption"),
        styled_table(
            ["Campo", "Papel"],
            [
                ("tenant_id", "Isolamento da operação e FK composta em todos os atores do resgate."),
                ("access_id / edition_id / offer_id", "Identificam entitlement, campanha e mecânica confirmada."),
                ("establishment_id / organization_id", "Escopo da unidade e da organização que realizou a validação."),
                ("user_id / redeemed_by", "Titular do benefício e membro parceiro que confirmou."),
                ("redemption_number", "Sequência por acesso/oferta; UNIQUE impede ultrapassagem concorrente silenciosa."),
                ("presentation_nonce_hash", "Hash SHA-256 único que torna replay idempotente."),
                ("receipt_code", "Código permanente e único apresentado às duas partes."),
                ("*_snapshot", "Nome da edição, oferta, termos, unidade e titular preservados no instante do uso."),
                ("redeemed_at", "Timestamp UTC do evento confirmado."),
            ],
            widths=[55 * mm, CONTENT_W - 55 * mm],
        ),
        H2("12.3 Catalog projection"),
        *bullet_list([
            "catalog_establishments concentra identidade pública, endereço, categorias, atributos públicos, horários, dias especiais e mídia aprovada em JSONB.",
            "normalized_name, search_text e search_vector suportam igualdade, prefixo, full-text em português e trigram.",
            "is_discoverable exige tenant, organização, região, cidade, unidade e revisão elegíveis, além de categoria ativa e uma capa aprovada.",
            "catalog_tenant_versions cresce monotonicamente a cada alteração relevante e participa da chave de cache.",
            "Triggers observam agregados e dependências; a projeção pode ser apagada e reconstruída sem perda de verdade transacional.",
        ]),
    ]

    story += [
        H1("13. Integridade, segurança e privacidade"),
        styled_table(
            ["Camada", "Mecanismo", "Risco mitigado"],
            [
                ("HTTP", "Vine validators, throttling, cookies seguros e headers privados.", "Entrada inválida, abuso e cache indevido."),
                ("Autenticação", "JWT curto, refresh opaco rotativo, HMAC para tokens de uso único.", "Roubo, replay e vazamento de token bruto."),
                ("Autorização", "RBAC global + policies de organização + tenant scope.", "IDOR e elevação de privilégio."),
                ("Transação", "Locks pessimistas em mudanças de estado e resgates.", "Race conditions e dupla confirmação."),
                ("Banco", "FKs compostas, CHECKs, índices únicos e parciais.", "Vazamento cross-tenant e estados impossíveis."),
                ("Mídia", "Probe binário, MIME/extensão coerentes, limites de dimensão e moderação.", "Polyglots, bombas de imagem e conteúdo não aprovado."),
                ("Analytics", "HMAC session, dedupe, DNT/GPC e retenção.", "Rastreamento desnecessário e inflação de métricas."),
                ("Benefícios", "Token curto, nonce único, revalidação server-side e snapshots.", "Fraude, replay e histórico mutável."),
            ],
            widths=[30 * mm, 75 * mm, CONTENT_W - 105 * mm],
        ),
        callout("Regra de exposição", "Endpoints públicos retornam DTOs allowlisted. Models Lucid completos e metadados internos não devem ser serializados diretamente para catálogo, analytics público ou páginas de apresentação.", color=RED, background=HexColor("#FEF2F2")),
    ]

    story += [PageBreak(), SectionDivider("04", "Governança, qualidade e evolução", "Rastreabilidade, requisitos não funcionais, validação do piloto e próximos passos."), Spacer(1, 8 * mm)]
    story += [
        H1("14. Rastreabilidade"),
        styled_table(
            ["Capacidade", "Requisitos", "ADRs", "Implementação principal", "Evidência"],
            [
                ("Operação e domínio", "RN-02 a RN-06", "0001, 0002, 0007 a 0011", "tenants, geography, taxonomy, organizations, permissions", "Suites geography, taxonomy, organizations e permissions"),
                ("Unidades revisionadas", "RN-07 a RN-10", "0004, 0005, 0012 a 0015", "establishments, media, portal", "Suites establishments, review_workflow e media"),
                ("Catálogo público", "RN-01, RN-11, RN-12", "0003, 0006, 0016", "catalog projection, resolver de hostname, cache", "Suite catalog e contratos SSR/API"),
                ("Analytics", "RN-12, RN-13", "0017", "analytics events, aggregates, redirects", "Suite analytics, DNT/GPC, retention e IDOR"),
                ("Portais e piloto", "RN-22 a RN-24", "0018", "portal, backoffice, pilot_feedback", "Suites portal, pilot_feedback e componentes React"),
                ("Edições e ofertas", "RN-14 a RN-16", "0019", "benefit_editions e benefit_offers", "Suite benefits e páginas operacionais"),
                ("Acesso e carteira", "RN-17, RN-21", "0020", "benefit_accesses e wallet projection", "Suite accesses e wallet"),
                ("Apresentação e resgate", "RN-18 a RN-21", "0021", "presentation token e benefit_redemptions", "Suites redemptions, API contract e browser flow"),
            ],
            widths=[31 * mm, 29 * mm, 31 * mm, 50 * mm, CONTENT_W - 141 * mm],
        ),
        H2("14.1 Definition of Done transversal"),
        *bullet_list([
            "Regra de negócio aceita em docs/product e, se estrutural, em ADR.",
            "Schema tenant-safe, migrations canônicas e rollback definido.",
            "Validação, policy, transação e constraints alinhadas.",
            "Regressão no nível mais próximo: unitário, funcional, browser ou frontend.",
            "OpenAPI, exemplos HTTP e documentação afetada atualizados.",
            "Lint, typecheck, suites Japa/Vitest e build verdes em Node 24.",
        ]),
    ]

    story += [
        H1("15. Requisitos não funcionais"),
        styled_table(
            ["ID", "Categoria", "Requisito"],
            [
                ("RNF-01", "Segurança", "Negar por padrão; não revelar existência de recursos de outra organização/tenant."),
                ("RNF-02", "Privacidade", "Coletar o mínimo; respeitar DNT/GPC; aplicar retenção e pseudonimização."),
                ("RNF-03", "Consistência", "Publicação, resgate e mudanças de estado críticas devem ser transacionais."),
                ("RNF-04", "Disponibilidade", "Falha de cache ou analytics não deve invalidar resposta pública correta."),
                ("RNF-05", "Desempenho", "Busca usa índices PostgreSQL e projeção; páginas públicas enviam cache-control apropriado."),
                ("RNF-06", "Acessibilidade", "Mídia aprovada exige alt text; navegação e feedback devem funcionar por teclado e leitor."),
                ("RNF-07", "Observabilidade", "Health checks cobrem processo, memória, disco e banco; ações relevantes são auditadas."),
                ("RNF-08", "Portabilidade", "Storage é abstrato; ambiente roda localmente e em containers com PostgreSQL e Redis."),
                ("RNF-09", "Manutenibilidade", "TypeScript strict, módulos por domínio, aliases estáveis e migrations pré-1.0 consolidadas."),
                ("RNF-10", "Testabilidade", "Fixtures/factories isoladas; testes funcionais verificam autorização e integridade no banco."),
            ],
            widths=[18 * mm, 34 * mm, CONTENT_W - 52 * mm],
        ),
    ]

    story += [
        H1("16. Estado do piloto e próximos passos"),
        P("O smoke local de 31/08/2026 percorreu a jornada consumidor -> parceiro -> consumidor em Chromium com PostgreSQL e Redis após instalação limpa do schema."),
        metric_cards([("3", "unidades publicadas"), ("2", "edições ativas"), ("2", "acessos na carteira"), ("4:59", "TTL inicial observado")]),
        Spacer(1, 5 * mm),
        styled_table(
            ["Prioridade", "Ação", "Critério"],
            [
                ("P1", "Eliminar avisos de hidratação dos IDs internos do Radix.", "Zero mismatch no layout autenticado."),
                ("P1", "Validar leitura do QR em Android e iOS reais.", "Câmeras nativas abrem o link sem intervenção técnica."),
                ("P1", "Validar carteira, portal e recibos nas larguras móveis alvo.", "Fluxo completo sem clipping ou ação inacessível."),
                ("P1", "Observar ao menos um consumidor e um parceiro.", "Ambos concluem e compreendem regras e comprovante."),
                ("P2", "Priorizar texto, navegação e filtros pelo padrão dos feedbacks.", "Backlog ordenado por frequência e impacto."),
                ("P2", "Decidir exportações e filtros operacionais.", "Necessidade confirmada nas sessões assistidas."),
                ("Posterior", "Avaliar checkout, assinatura e promo codes.", "Somente após gates do piloto e viabilidade comercial."),
            ],
            widths=[20 * mm, 83 * mm, CONTENT_W - 103 * mm],
        ),
        callout("Critério de avanço", "Nenhum novo corte comercial deve começar enquanto houver falha P0/P1 na jornada, dependência de intervenção técnica ou incompreensão relevante das regras e do comprovante.", color=GREEN, background=HexColor("#F0FDF4")),
    ]

    story += [
        H1("17. Glossário"),
        styled_table(
            ["Termo", "Definição"],
            [
                ("Tenant", "Operação isolada da plataforma; não é cidade, organização ou unidade."),
                ("Organização", "Pessoa jurídica ou operação comercial responsável por uma ou mais unidades."),
                ("Estabelecimento / unidade", "Local ou serviço público descoberto pelo consumidor."),
                ("Revision", "Snapshot versionado de conteúdo público de uma unidade."),
                ("Published revision", "Revisão aprovada apontada pelo estabelecimento e exposta no catálogo."),
                ("Gate", "Avaliação versionada que produz elegibilidade, score, blockers e warnings."),
                ("Projection", "Read model derivado e reconstruível para um consumidor específico."),
                ("Membership", "Vínculo contextual de um usuário com tenant ou organização."),
                ("Edition", "Campanha de benefícios por cidade e janela de uso."),
                ("Offer", "Mecânica concreta oferecida por uma unidade dentro de uma edição."),
                ("Benefit access", "Entitlement que habilita um usuário a consumir uma edição."),
                ("Presentation", "Token temporário que comunica intenção de uso; ainda não é resgate."),
                ("Redemption", "Confirmação transacional do uso, com nonce, snapshots e recibo."),
                ("DNT / GPC", "Sinais de preferência de privacidade respeitados na coleta analítica."),
            ],
            widths=[45 * mm, CONTENT_W - 45 * mm],
        ),
        H1("18. Referências internas"),
        *bullet_list([
            "docs/product/README.md e documentos 01 a 16 - visão, jornadas, roadmap, analytics, benefícios e piloto.",
            "docs/architecture/decisions/0001 a 0021 - contratos arquiteturais aceitos.",
            "database/migrations - schema canônico e funções/triggers PostgreSQL.",
            "docs/openapi.yaml e docs/api.http - contratos HTTP e exemplos operacionais.",
            "tests/functional, tests/browser e inertia/tests - evidências executáveis dos requisitos.",
            "AGENTS.md - convenções de domínio, arquitetura e engenharia do repositório.",
        ]),
        Spacer(1, 10 * mm),
        callout("Nota de manutenção", "O README introdutório ainda contém referências antigas a EP-08 e trata benefícios como evolução futura. Esta documentação usa a baseline canônica EP-11, confirmada pelos ADRs, migrations, código e evidências do piloto.", color=AMBER, background=HexColor("#FFFBEB")),
        Spacer(1, 20 * mm),
        P("Fim da documentação - Experimente+ - Baseline EP-11", "caption"),
    ]

    return story


def parse_args():
    parser = argparse.ArgumentParser(
        description="Gera a documentação profissional de negócio e dados do Experimente+."
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Arquivo PDF de saída (padrão: {DEFAULT_OUTPUT})",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    output = args.output.expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    doc = ExperimenteDocTemplate(str(output))
    doc.multiBuild(build_story())
    print(output)


if __name__ == "__main__":
    main()
