# 📜 Chronicles of Lineage

A data‑driven, interactive genealogy explorer that visualizes the **complete ancestral lineage** from **Adam to Noah**, the **covenant line of Abraham**, and the **descent from Adnan to Muhammad** — all in one unified graph.
---

## 🧭 Purpose & Research Context

This project was built to provide a **clear, objective, and historically grounded roadmap** across thousands of years of biblical and traditional genealogies.  

Unlike most genealogy websites that present disjointed family trees or focus on a single tradition, this tool **stitches together**:

- **Adam → Noah** – The earliest biblical patriarchs.
- **Abraham’s lineage** – The covenant line that branches toward both Isaac and Ishmael.
- **Adnan → Muhammad** – The continuous line from the common ancestor of the northern Arabian tribes to the Prophet, as recorded in Islamic and historical sources.

The visualisation is **exclusively data‑driven**, based on **Wikidata’s curated statements**, and makes no theological claims — it simply renders the relationships as they are structured in the knowledge graph.

**Why this matters:**  
Most resources either omit the Adnanite lineage entirely, or they treat the biblical and Islamic genealogies as separate domains. This project places them side‑by‑side, showing the full continuum from Adam to Muhammad, and makes the **gap between Kedar (Ishmael’s son) and Adnan** explicit — a point often glossed over.

---

## ✨ Features

- **Three main lineage tabs** – switch between “Adam to Noah”, “Covenant of Abraham”, and “Line of Adnan”.
- **Zoom & pan** – explore the graph with mouse wheel and drag.
- **Click any node** – instantly highlights the entire descendant branch, opens a biographical card, and smoothly zooms to the person.
- **Search** – type a name to locate a person across all lineages; the graph automatically switches to the correct tab and focuses on that person.
- **Dark / Light mode** – toggle between a warm parchment (light) and deep ink (dark) theme.
- **Generation markers** – each row is annotated with a dashed guide; hover to see the generation number (Roman numerals) and the estimated year span.
- **Person card** – displays name, image (if available), lifespan, parents, children, sources, and a direct link to the Wikidata entry.
- **Research‑ready data** – all relationships are pulled from Wikidata, ensuring provenance and reproducibility.

---

## 🧠 Technical Architecture

The application is built with **React** and **D3.js** for rendering, and employs several graph‑algorithmic techniques to lay out the data cleanly.

### 1. Data Loading & Management (`GenealogyLoader`, `GraphManager`)

- **`GenealogyLoader`** fetches a static JSON file (`/data/genealogy-graph.json`) containing nodes (persons) and edges (parent‑child relationships). It also provides a status callback for loading feedback.
- **`GraphManager`** builds an **adjacency list** from the edges, storing `parents` and `children` for each node. It offers:
  - `getPerson(id)` – O(1) lookup.
  - `getRelations(id)` – returns the adjacency entry.
  - **`buildLineageMap(seedIds)`** – runs a **multi‑source Breadth‑First Search (BFS)** from the three seed roots (Adam, Abraham, Adnan) over **child edges**. Each node is assigned to the **closest seed** (shortest distance). This allows instant tab‑switching when you click on any person.

### 2. Tree Extraction (`buildStrictTree`)

- **Descendant collection** – starting from the current `rootId`, a DFS over child edges collects all descendants.
- **Single‑parent resolution** – for each descendant, we select the **first parent that is also within the descendant set**. This removes maternal/paternal ambiguity and produces a strict tree (one parent per node), suitable for layout.

### 3. Layout Algorithm: Reingold‑Tilford Tidy Tree Variant

The graph is laid out using a **bottom‑up, top‑down recursive algorithm** reminiscent of the classic Reingold‑Tilford method:

- **`computeWidth(id, tree, memo)`** – recursively calculates the total horizontal width of each subtree. Leaf width = `NODE_WIDTH`; internal width = sum of children’s widths + `NODE_X_GAP` between siblings.
- **`layout(id, tree, pos, x, y, memo)`** – positions the node at `(x, y)` and places its children on the next row (`y + ROW_GAP`), **centering the parent horizontally over its children**.
  - Parent X = `x + (total branch width / 2) – (NODE_WIDTH / 2)`
- The result is a compact, non‑overlapping tree where every generation aligns on the same Y coordinate.

### 4. Rendering & Interaction (D3 Zoom + SVG)

- **Zoom / Pan** – D3’s `zoom` behavior, with scale limits 0.1× – 2.5×.
- **Edges** – drawn as orthogonal paths (parent bottom → horizontal mid‑point → child top). Active branches are highlighted in gold.
- **Nodes** – rectangular blocks with name and abbreviated lifespan. Clicking a node updates the global highlight state and triggers a smooth zoom‑to‑node transition.
- **Descendant highlighting** – `traceDescendants` computes the set of all descendants of the active node; non‑members are faded.
- **Generation rows** – after layout, nodes are grouped by their Y coordinate; each row gets a faint dashed line and a hover‑revealed label with generation number (Roman numerals) and year range.

### 5. Theming & Responsiveness

- **Dark / Light** – toggles between warm parchment and deep ink, affecting background, text, and border colours.
- **Fully responsive** – the SVG scales with the container; initial zoom fits the root node.

---

## 🗃️ Data Extraction

The graph data is not hard‑coded – it is **fetched directly from Wikidata** using a Python script that performs a **BFS traversal** over the Wikidata knowledge graph.

### How the script works

- **`fetch_data.py`** – uses the Wikidata API (`wbgetentities`) to retrieve entities in batches.
- **Seed list** – the script starts from a curated list of ~80 known QIDs that span the entire lineage (Adam, Noah, Abraham, Ishmael, the authenticated chain from Muhammad back to Adnan, and key descendants).
- **BFS expansion** – from each seed, it follows `P22` (father), `P25` (mother), and `P40` (child) claims, enqueuing new QIDs up to a configurable depth and person limit.
- **Filtering** – it skips disambiguation pages, religious‑variant articles (e.g., “Jesus in Islam”), and obviously unrelated fictional characters, while protecting a `NEVER_FILTER` set that ensures all major figures are kept.
- **Output** – the final `genealogy-graph.json` contains a clean `{ nodes: [...], edges: [...] }` structure, ready for the React app.

To regenerate the data (e.g., after Wikidata updates):

```bash
python3 fetch_data.py
```

The script will output `genealogy-graph.json` in the same directory. Place this file in `public/data/` of the React project.

---

## 🛠️ Stack

- **React** – UI framework.
- **D3.js** – zoom/pan, transitions, and basic SVG manipulation.
- **CSS-in‑JS** – inline styles for theming.
- **Wikidata** – primary data source.
- **Static JSON** – stores the graph structure (generated offline via the Python script).

---

## 🙏 Acknowledgements

- **Wikidata** – the core data source. All person IDs and relationships are derived from Wikidata’s structured knowledge base.

---

## 🚀 Getting Started

1. **Clone the repository**  
   ```bash
   git clone https://github.com/tlynx538/AdamGenealogy.git
   cd AdamGenealogy
   ```

2. **Install dependencies**  
   ```bash
   npm install
   ```

3. **(Optional) Fetch the latest data**  
   ```bash
   python3 fetch_data.py
   cp genealogy-graph.json public/data/
   ```

4. **Run the development server**  
   ```bash
   npm start
   ```

5. **Build for production**  
   ```bash
   npm run build
   ```

The app expects the JSON file at `public/data/genealogy-graph.json`. If you skip step 3, a pre‑built version is included.

---

## 📄 License

This project is open source and available under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

## 👤 Author

Built by **Vinayak Jaiwant Mooliyil.** – [vjaiwantx.co](https://vjaiwantx.co)  
GitHub: [tlynx538](https://github.com/tlynx538)

---

> *“Genealogy is not just a list of names – it is the story of how we are all connected.”*