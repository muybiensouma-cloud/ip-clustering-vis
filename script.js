// 【線（エッジ）をクリックしたときのツールチップ】
const edgeTooltip = new G6.Tooltip({
    itemTypes: ['edge'],
    trigger: 'click',
    getContent: (e) => {
        const model = e.item.getModel();
        return `
            <div style="color: #fff; padding: 4px;">
                <div style="font-weight: bold; margin-bottom: 4px; font-size: 14px;">Score: ${model.scoreText}</div>
                <div style="font-size: 12px; line-height: 1.4;">${model.matchDetails}</div>
            </div>
        `;
    }
});

// グラフの初期化
const graph = new G6.Graph({
    container: 'container',
    width: window.innerWidth,
    height: window.innerHeight,
    plugins: [edgeTooltip], // エッジ用ツールチップのみ有効化
    layout: {
        type: 'force',
        preventOverlap: true,
        nodeSize: 30,
        linkDistance: 120,
        nodeStrength: -100,
        edgeStrength: 0.1,
        animate: false 
    },
    modes: {
        default: ['drag-canvas', 'zoom-canvas', 'drag-node'],
    },
    nodeStateStyles: {
        active: { lineWidth: 3, shadowBlur: 15, shadowColor: '#555' },
        inactive: { opacity: 0.1 },
        'search-active': { stroke: '#ff0000', lineWidth: 5, shadowBlur: 20, shadowColor: '#ff0000' }
    },
    edgeStateStyles: {
        active: { stroke: '#333', lineWidth: 2, opacity: 1 },
        inactive: { opacity: 0.1 },
    }
});

const csvFileName = 'final_relations.csv';

Papa.parse(csvFileName, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
        const data = results.data;
        const nodesMap = {};
        const edges = [];
        const degreeMap = {}; 

        // 次数計算
        data.forEach(row => {
            if (!row['Target_IP'] || !row['Similar_IP']) return;
            degreeMap[row['Target_IP']] = (degreeMap[row['Target_IP']] || 0) + 1;
            degreeMap[row['Similar_IP']] = (degreeMap[row['Similar_IP']] || 0) + 1;
        });

        // ノード・エッジの生成
        data.forEach(row => {
            const source = row['Target_IP'];
            const target = row['Similar_IP'];
            if (!source || !target) return;

            let scoreText = row['Score'] || 'Unknown';
            let scoreVal = (!isNaN(parseFloat(scoreText))) ? parseFloat(scoreText) : 0.5;
            let isLowScore = scoreVal < 0.5;
            const matchDetails = row['Match_Details'] || 'Unknown';

            // 調査IP（Target）の登録
            if (!nodesMap[source]) {
                nodesMap[source] = { 
                    id: source, label: source, degree: degreeMap[source],
                    nodeType: '調査IP',
                    size: 25, style: { fill: '#FF6B6B', stroke: '#d9534f' },
                    labelCfg: { style: { fill: '#333', fontSize: 12, fontWeight: 'bold' } },
                    detailData: { ASN: row['Target_ASN'], Port: row['Target_Ports'], ja4t: row['Target_ja4t'] }
                };
            }

            // 類似IP（Similar）の登録
            if (!nodesMap[target]) {
                nodesMap[target] = { 
                    id: target, label: target, degree: degreeMap[target],
                    nodeType: '類似IP',
                    size: 15, style: { fill: '#4D96FF', stroke: '#3a7bd5' },
                    labelCfg: { position: 'bottom', style: { fill: '#666', fontSize: 10 } },
                    detailData: { ASN: row['Similar_ASN'], Port: row['Similar_Ports'], ja4t: row['Similar_ja4t'] }
                };
            }

            edges.push({ 
                source: source, target: target,
                scoreText: scoreText,
                matchDetails: matchDetails,
                style: {
                    lineWidth: scoreText === 'Unknown' ? 1 : scoreVal * 3, 
                    lineDash: isLowScore ? [5, 5] : undefined,
                    stroke: isLowScore ? '#ccc' : '#999',
                    opacity: 0.7
                }
            });
        });

        graph.data({ nodes: Object.values(nodesMap), edges: edges });
        graph.render();

        // ネットワーク探索用の関数
        function getConnectedComponent(startNode) {
            const connectedNodes = new Set([startNode]);
            const connectedEdges = new Set();
            const queue = [startNode];
            while (queue.length > 0) {
                const current = queue.shift();
                current.getEdges().forEach(edge => {
                    if (!connectedEdges.has(edge)) {
                        connectedEdges.add(edge);
                        const neighbor = edge.getSource() === current ? edge.getTarget() : edge.getSource();
                        if (!connectedNodes.has(neighbor)) {
                            connectedNodes.add(neighbor);
                            queue.push(neighbor);
                        }
                    }
                });
            }
            return { nodes: connectedNodes, edges: connectedEdges };
        }

        function clearAllHighlights() {
            graph.getNodes().forEach(n => {
                if (!n.hasState('search-active')) graph.clearItemStates(n, ['active', 'inactive']);
            });
            graph.getEdges().forEach(edge => graph.clearItemStates(edge, ['active', 'inactive']));
        }

        // ==========================================
        // 詳細情報の表示処理（右側パネル内に表示）
        // ==========================================
        const detailContainer = document.getElementById('detailInfoContainer');

        function handleNodeSelect(item) {
            clearAllHighlights(); 
            
            // 1. グラフ上のハイライト処理
            const { nodes, edges } = getConnectedComponent(item);
            graph.getNodes().forEach(n => {
                if (!n.hasState('search-active')) {
                    graph.setItemState(n, nodes.has(n) ? 'active' : 'inactive', true);
                }
            });
            graph.getEdges().forEach(edge => graph.setItemState(edge, edges.has(edge) ? 'active' : 'inactive', true));

            // 2. パネルに表示するデータの準備
            const model = item.getModel();
            const neighbors = item.getNeighbors().map(n => n.getModel());
            
            // 紐付け先IPのリストをHTML化
            const neighborsHtml = neighbors.map(n => {
                const color = n.nodeType === '調査IP' ? '#FF6B6B' : '#4D96FF';
                return `
                    <li style="margin-bottom: 6px; border-bottom: 1px dashed #ccc; padding-bottom: 4px;">
                        <a href="#" class="neighbor-link" data-id="${n.id}" style="color: #333; text-decoration: none; display: flex; align-items: center;">
                            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${color}; margin-right:6px;"></span>
                            <span style="text-decoration: underline;">${n.id}</span>
                        </a>
                    </li>
                `;
            }).join('');

            const badgeColor = model.nodeType === '調査IP' ? '#FF6B6B' : '#4D96FF';
            const badgeHtml = `<span style="background-color: ${badgeColor}; color: white; font-size: 11px; padding: 2px 6px; border-radius: 12px; margin-left: 5px; vertical-align: middle;">${model.nodeType}</span>`;

            // 3. 右側パネル内のコンテナにHTMLを流し込んで表示
            if (detailContainer) {
                detailContainer.innerHTML = `
                    <div style="margin-bottom: 10px;">
                        <span style="font-size: 16px; font-weight: bold;">${model.id}</span>
                        ${badgeHtml}
                    </div>
                    <div style="line-height: 1.5;">
                        <p><strong>全体の接続数:</strong> ${model.degree}</p>
                        <hr style="border:none; border-top:1px dashed #ccc; margin: 8px 0;">
                        <p><strong>ASN:</strong><br> ${model.detailData.ASN}</p>
                        <p><strong>Port:</strong><br> ${model.detailData.Port}</p>
                        <p><strong>ja4t:</strong><br> ${model.detailData.ja4t}</p>
                    </div>
                    
                    <div style="margin-top: 15px; background: #f9f9f9; padding: 10px; border-radius: 6px; border: 1px solid #eee;">
                        <p style="margin: 0 0 10px 0; font-weight: bold;">直接紐付けられているIP (${neighbors.length}件)</p>
                        <ul style="list-style: none; padding: 0; margin: 0; max-height: 150px; overflow-y: auto;">
                            ${neighborsHtml}
                        </ul>
                    </div>
                `;
                detailContainer.style.display = 'block'; // エリアを表示する
            }

            // 4. リスト内のIPがクリックされたときのイベント
            document.querySelectorAll('.neighbor-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault(); 
                    const targetId = e.currentTarget.getAttribute('data-id');
                    const targetNode = graph.findById(targetId);
                    
                    if (targetNode) {
                        graph.focusItem(targetNode, true, { easing: 'easeCubic', duration: 600 });
                        handleNodeSelect(targetNode);
                    }
                });
            });
        }

        graph.on('node:click', (e) => {
            handleNodeSelect(e.item);
        });

        // キャンバス（背景）クリック時：ハイライトを消し、詳細エリアも隠す
        graph.on('canvas:click', () => {
            clearAllHighlights();
            if (detailContainer) detailContainer.style.display = 'none';
        });

        // ==========================================
        // UI操作系（コントロールパネル等）
        // ==========================================
        const toggleBtn = document.getElementById('togglePanelBtn');
        const panelContent = document.getElementById('panelContent');
        if (toggleBtn && panelContent) {
            toggleBtn.onclick = () => {
                panelContent.classList.toggle('closed');
                toggleBtn.innerText = panelContent.classList.contains('closed') ? '▲ 開く' : '▼ 閉じる';
            };
        }

        const zoomSlider = document.getElementById('zoomSlider');
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');

        function getCenter() { return { x: window.innerWidth / 2, y: window.innerHeight / 2 }; }

        if (zoomSlider) {
            zoomSlider.oninput = (e) => { graph.zoomTo(parseFloat(e.target.value), getCenter()); };
        }
        if (zoomInBtn && zoomSlider) {
            zoomInBtn.onclick = () => {
                let val = Math.min(3, parseFloat(zoomSlider.value) + 0.2);
                zoomSlider.value = val;
                graph.zoomTo(val, getCenter());
            };
        }
        if (zoomOutBtn && zoomSlider) {
            zoomOutBtn.onclick = () => {
                let val = Math.max(0.1, parseFloat(zoomSlider.value) - 0.2);
                zoomSlider.value = val;
                graph.zoomTo(val, getCenter());
            };
        }

        graph.on('wheelzoom', () => {
            if (zoomSlider) {
                let sliderVal = graph.getZoom();
                if (sliderVal > 3) sliderVal = 3;
                if (sliderVal < 0.1) sliderVal = 0.1;
                zoomSlider.value = sliderVal;
            }
        });

        let currentSearchNode = null;
        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) {
            searchBtn.onclick = () => {
                const keyword = document.getElementById('searchInput').value;
                const item = graph.findById(keyword);
                
                if (currentSearchNode && !currentSearchNode.destroyed) {
                    graph.clearItemStates(currentSearchNode, ['search-active']);
                }

                if (item) {
                    graph.focusItem(item, true, { easing: 'easeCubic', duration: 800 });
                    graph.setItemState(item, 'search-active', true);
                    currentSearchNode = item; 
                    handleNodeSelect(item); 
                } else {
                    alert('見つかりませんでした。');
                }
            };
        }

        const degreeSlider = document.getElementById('degreeSlider');
        if (degreeSlider) {
            degreeSlider.oninput = (e) => {
                const threshold = parseInt(e.target.value);
                document.getElementById('degreeVal').innerText = threshold;
                graph.getNodes().forEach(node => {
                    if (node.getModel().degree < threshold) graph.hideItem(node);
                    else graph.showItem(node);
                });
            };
        }
    }
});

window.onresize = () => {
    if (!graph || graph.get('destroyed')) return;
    graph.changeSize(window.innerWidth, window.innerHeight);
};