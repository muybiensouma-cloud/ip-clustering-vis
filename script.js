// グラフの初期設定
const graph = new G6.Graph({
    container: 'container',
    width: window.innerWidth,
    height: window.innerHeight,
    // 力学モデル（Force）の設定
    layout: {
        type: 'force',
        preventOverlap: true, // ノード同士の重なりを防ぐ
        linkDistance: 120,    // 線の基本長さ
        nodeStrength: -60     // ノード同士の反発力（マイナスが大きいほど離れる）
    },
    // マウス操作の設定（ドラッグ、ズーム、ツールチップ）
    modes: {
        default: [
            'drag-canvas', 
            'zoom-canvas', 
            'drag-node',
            {
                type: 'tooltip',
                formatText: function formatText(model) {
                    return 'IP: ' + model.id;
                },
                offset: 10
            }
        ],
    },
    // エッジ（線）のデフォルト設定
    defaultEdge: {
        style: {
            stroke: '#b5b5b5',
            lineWidth: 1,
        },
    },
});

// JSONデータを取得して描画する処理
fetch('graph_data.json')
    .then(response => response.json())
    .then(data => {
        graph.data(data);
        graph.render();
    })
    .catch(error => console.error('Error loading JSON:', error));

// ウィンドウサイズが変わった時にキャンバスサイズを自動調整
window.onresize = () => {
    if (!graph || graph.get('destroyed')) return;
    graph.changeSize(window.innerWidth, window.innerHeight);
};