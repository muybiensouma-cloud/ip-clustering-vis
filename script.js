// グラフの初期設定
const graph = new G6.Graph({
    container: 'container',
    width: window.innerWidth,
    height: window.innerHeight,
    // 力学モデル（Force）の設定
    layout: {
        type: 'force',
        preventOverlap: true, // ノードの重なりを防ぐ
        linkDistance: 80,     // 線の長さ
        nodeStrength: -30     // 反発力
    },
    modes: {
        default: ['drag-canvas', 'zoom-canvas', 'drag-node'],
    },
    defaultEdge: {
        style: {
            stroke: '#b5b5b5',
            lineWidth: 1,
            opacity: 0.6
        },
    },
});

// ★ここでCSVファイルを直接読み込みます★
// （ファイル名が違う場合はここを書き換えてください）
const csvFileName = 'final_relations.csv';

Papa.parse(csvFileName, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
        const data = results.data;
        const nodesMap = {};
        const edges = [];

        // CSVの1行ずつ処理していく
        data.forEach(row => {
            const source = row['Target_IP'];
            const target = row['Similar_IP'];

            if (!source || !target) return;

            // 起点となるIP（Target_IP）の設定：赤色で大きく
            if (!nodesMap[source]) {
                nodesMap[source] = { 
                    id: source, 
                    label: source, 
                    size: 25, 
                    style: { fill: '#FF6B6B', stroke: '#d9534f' },
                    labelCfg: { style: { fill: '#333', fontSize: 12, fontWeight: 'bold' } }
                };
            }

            // 類似IP（Similar_IP）の設定：青色で小さく
            if (!nodesMap[target]) {
                nodesMap[target] = { 
                    id: target, 
                    label: target, 
                    size: 12, 
                    style: { fill: '#4D96FF', stroke: '#3a7bd5' },
                    labelCfg: { position: 'bottom', style: { fill: '#666', fontSize: 10 } }
                };
            }

            // 点と点を結ぶ線（エッジ）を追加
            edges.push({ source: source, target: target });
        });

        // グラフを描画
        graph.data({
            nodes: Object.values(nodesMap),
            edges: edges
        });
        graph.render();
    }
});

// 画面サイズが変わったときの自動調整
window.onresize = () => {
    if (!graph || graph.get('destroyed')) return;
    graph.changeSize(window.innerWidth, window.innerHeight);
};