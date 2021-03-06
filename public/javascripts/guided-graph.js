var guidedGraph;

(function (guidedGraph) {

    guidedGraph.instance = function () {
        var _instance = {};

        var _graph;
        var _nodes = [];
        var _links = [];
        var _groups = [];

        var _gridCellWidth = 0;
        var _gridCellHeight = 0;

        var _parent, _svg, _diagonal;

        var _distanceText = 80;
        var _boxPadding = 0;
        var _selected = [];

        var NO_MODE = 0;
        var MOVE_MODE = 2;
        var SCREEN_MOVE_MODE = 4;
        var ADD_LINK_MODE = 8;
        var SELECTION_LINK_MODE = 16;
        var SELECTION_NODE_MODE = 32;
        var _mode;
        var _lastMode;

        var _screenRefX = 0;
        var _screenRefY = 0;
        var _startScreenPosition = [];
        var _lastScreenPosition = [];

        var _onSelectEvent;

        _instance.init = function(divId, initGraph, areaWidth, areHeight, gridCellWidth, gridCellHeight) {

            _graph = initGraph;

            _instance.size(gridCellWidth, gridCellHeight)
                .nodes(_graph.nodes)
                .links(_graph.links)
                .groups(_graph.groups);

            _parent = d3.select('#' + divId);

            _parent.select('svg').remove();

            _svg = d3.select('#' + divId)
                .append('svg')
                .attr('id', 'svg')
                .attr('width', areaWidth)
                .attr('height', areHeight)
                .attr('style', 'background-color: white');

            _diagonal = d3.svg.diagonal()
                .projection(function(d) {
                    return [d.x, d.y];
                });

            _svg.append('svg:defs').append('svg:marker')
                .attr('id', 'end-arrow')
                .attr('viewBox', '0 0 10 10')
                .attr('refX', 26)
                .attr('refY', 5)
                .attr('markerWidth', 5)
                .attr('markerHeight', 5)
                .attr('orient', 'auto')
                .append('svg:path')
                .attr('d', 'M 0 0 L 10 5 L 0 10 z')
                .attr('fill', '#000');

            _svg.append('g')
                .attr('class', 'groups');

            _svg.append('g')
                .attr('class', 'links');

            defineEvents();

            return _instance;
        };

        function defineEvents() {
            _svg.on('mousedown', function() {
                _lastMode = _mode;
                _mode = SCREEN_MOVE_MODE;
                _lastScreenPosition = d3.mouse(this);
                _startScreenPosition = _lastScreenPosition;
            });

            _svg.on('mouseup', function() {
                if (_mode == MOVE_MODE) {
                    _mode = SELECTION_NODE_MODE;

                    _svg.classed('move-mode', false);

                    /*
                    var bounds = _instance.getBounds();
                    var width = parseInt(d3.select('#svg').attr('width'));

                    if (bounds[0] > _gridCellWidth / 2) {

                        var steps = ((bounds[0] - _gridCellWidth / 2) / _gridCellWidth);

                        _instance.stepTo(steps * -1, 0);

                    }

                    bounds = _instance.getBounds();

                    //if (bounds[0] + bounds[2] != width - _gridCellWidth / 2) {
                        d3.select('#svg').attr('width', bounds[0] + bounds[2] + _gridCellWidth / 2);
                    //}

                    console.debug('mouseup');

                    _instance.draw();
                    */
                } else if (_mode == ADD_LINK_MODE) {
                    _mode = SELECTION_LINK_MODE;

                    _svg.classed('add-link-mode', false);

                } else if (_mode == SCREEN_MOVE_MODE) {
                    var m = d3.mouse(this);

                    if (m[0] == _startScreenPosition[0] && m[1] == _startScreenPosition[1]) {
                        _mode = NO_MODE;

                        clearSelectedArray();

                        _instance.draw();
                    } else {
                        _mode = _lastMode;
                    }

                    _svg.classed('move-mode', false);
                }
            });

            _svg.on('mousemove', function() {
                var m = d3.mouse(this);

                if (_selected.length > 0) {
                    if (_mode == MOVE_MODE) {

                        var redraw = false;

                        _selected.forEach(function (n) {
                            var c = _instance.convertToCoord(m[0] - _screenRefX, m[1] - _screenRefY);
                            var lastCoord = n.__data__.coord;

                            if (lastCoord[0] != c[0] || lastCoord[1] != c[1]) {
                                n.__data__.coord = c;

                                redraw = true;
                            }
                        });

                        if (redraw) {
                            _instance.draw();
                        }
                        //} else if (_mode == ADD_LINK_MODE) {

                    }
                }

                if (_mode == SCREEN_MOVE_MODE) {

                    if (_lastScreenPosition.length == 0)
                        _lastScreenPosition = m;
                    //if (_screenRefX == 0 && _screenRefY == 0) {
                    //    _screenRefX = m[0];
                    //    _screenRefY = m[1];
                    //}

                    var dx = m[0] - _lastScreenPosition[0];
                    var dy = m[1] - _lastScreenPosition[1];
                    _screenRefX = _screenRefX + dx;
                    _screenRefY = _screenRefY + dy;

                    _instance.moveNodesByXY(dx, dy);
                    //_instance.draw();

                    _lastScreenPosition = m;

                    _svg.classed('move-mode', true);
                }
            });
        }

        _instance.draw = function() {

            _instance.calculatePositions();

            // Nodes
            var nodes = _svg.selectAll('g.node')
                .data(_nodes, function(n) {
                    return n.id;
                });

            var gnodes = nodes.enter()
                .append('g')
                .attr('class', 'node')
                .attr('transform', function(n) {
                    return 'translate(' + [n.x, n.y] + ')';
                });

            nodes.exit().remove();

            drawNodes();
            defineNodeEvents();

            nodes.transition()
                .attr('transform', function(n) {
                    return 'translate(' + n.x + ',' + n.y + ')';
                });


            // Links
            var links = _svg.select('g.links').selectAll('path.link')
                .data(_links, function(l) {
                    // Define an identifier, in this case, it is possible
                    // to define two different links between source and target.
                    // To define more than 2 links, it is necessary to change this identifier.
                    return l.source.id + '-' + l.target.id;
                });

            links.enter()
                .append('path')
                .attr('class', 'link');

            links.transition().
                attr('d', _diagonal).
                attr('transform', function() {
                    return "translate(0,0)";
                });

            links.on('mousedown', function() {
                clearSelectedArray();

                _selected.push(this);
                _mode = SELECTION_LINK_MODE;

                d3.select(this).classed('selected-link', true);

                _instance.draw();

                d3.event.stopPropagation();
            });

            links.exit().remove();


            // Groups
            var groups = _svg.select('g.groups').selectAll('g.group')
                .data(_groups, function(g) {
                    return g.id;
                });

            var ggroups = groups.enter()
                .append('g')
                .attr('class', 'group')
                .attr('transform', function(g) {
                    g.finalX = g.x - _boxPadding * g.level;
                    g.finalY = g.y - _boxPadding * g.level;

                    return 'translate(' + g.finalX + ',' + g.finalY + ')';
                });

            ggroups.append('text')
                .attr('class', 'name')
                .attr('dx', -10)
                .attr('dy', -10)
                .text(function(g) {
                    return g.name;
                })
                .each(function(g) {
                    g.textWidth = this.getBBox().width;
                });

            ggroups.append('rect');

            groups.transition()
                .attr('transform', function(g) {
                    g.finalX = g.x - _boxPadding * g.level;
                    g.finalY = g.y - _boxPadding * g.level;

                    return 'translate(' + g.finalX + ',' + g.finalY + ')';
                });

            groups.select('rect')
                .transition()
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', function(g) {
                    var maxX = Number.MIN_SAFE_INTEGER;
                    var maxTextWidth = 0;

                    g.leaves.forEach(function(l) {
                        var leafWidth = l.x + _distanceText + l.textWidth;

                        if (maxX < leafWidth) {
                            maxX = leafWidth;
                            maxTextWidth = l.textWidth;
                        }
                    });

                    g.finalWidth = g.width + maxTextWidth + _distanceText + 10 + _boxPadding * (g.level - 1) * 2;

                    return g.finalWidth;
                })
                .attr('height', function(g) {
                    g.finalHeight = g.height + 2 * _boxPadding * g.level;

                    return g.finalHeight;
                })
                .attr('rx', 10)
                .attr('ry', 10)
                .attr('stroke-dasharray', '5,5');

            groups.select('text')
                .transition()
                .attr('x', function(g) {
                    return g.finalWidth - g.textWidth;
                });

            groups.exit().remove();

            // Draw selection
            nodes
                .select('circle.selected')
                .attr('visibility', function() {
                    return d3.select(this.parentNode).attr('class').indexOf('selected-node') > -1 &&
                        _mode == ADD_LINK_MODE && this.parentNode != _selected[0] ? 'visible' : 'hidden';
                });

            nodes
                .selectAll('path.selected')
                .attr('visibility', function() {
                    return d3.select(this.parentNode).attr('class').indexOf('selected-node') > -1 &&
                        _selected.length == 1 &&
                        (_mode != ADD_LINK_MODE || (_mode == ADD_LINK_MODE && this.parentNode == _selected[0])) ?
                            'visible' : 'hidden';
                });

            function drawNodes() {
                gnodes.append('text')
                    .attr('class', 'name')
                    .attr('x', 0)
                    .attr('y', 0)
                    .attr('dx', 35)
                    .attr('dy', 18)
                    .attr('text-anchor', 'start')
                    .text(function(n) {
                        return n.name;
                    })
                    .append('tspan')
                    .attr('class', 'description1')
                    .attr('x', 0)
                    .attr('y', 0)
                    .attr('dx', 35)
                    .attr('dy', 32)
                    .text(function(n) {
                        return n.description1;
                    })
                    .each(function(n) {
                        n.textWidth = this.getBBox().width;
                    });

                nodes.selectAll('text')
                    .text(function(n) {
                        return n.name;
                    })
                    .append('tspan')
                    .attr('class', 'description1')
                    .attr('x', 0)
                    .attr('y', 0)
                    .attr('dx', 35)
                    .attr('dy', 32)
                    .text(function(n) {
                        return n.description1;
                    })
                    .each(function(n) {
                        n.textWidth = this.getBBox().width;
                    });

                gnodes.append('circle')
                    .attr('class', 'node')
                    .attr('r', 26);

                gnodes.append('path')
                    .attr('class', 'icon')
                    .attr('d', function(n) {
                        return icons[n.appType] ? icons[n.appType].d : '';
                    })
                    .attr('transform', function(n) {
                        return icons[n.appType] ? icons[n.appType].transform : '';
                    });

                nodes.selectAll('g>path.icon')
                    .attr('d', function(n) {
                        return icons[n.appType] ? icons[n.appType].d : '';
                    })
                    .attr('transform', function(n) {
                        return icons[n.appType] ? icons[n.appType].transform : '';
                    });

                gnodes.append('circle')
                    .attr('class', 'selected')
                    .attr('r', 30)
                    .attr('visibility', 'hidden');

                var d = 36;

                // Arrow West
                gnodes.append('path')
                    .attr('class', 'selected')
                    .attr('d', 'M-5 0 L5 -10 L5 10Z')
                    .attr('transform', 'translate(-' + d + ' 0)')
                    .attr('visibility', 'hidden');

                // Arrow East
                gnodes.append('path')
                    .attr('class', 'selected')
                    .attr('d', 'M-5 -10 L5 0 L-5 10Z')
                    .attr('transform', 'translate(' + d + ' 0)')
                    .attr('visibility', 'hidden');

                // Arrow South
                gnodes.append('path')
                    .attr('class', 'selected')
                    .attr('d', 'M-10 -5 L0 5 L10 -5Z')
                    .attr('transform', 'translate(0 ' + d + ')')
                    .attr('visibility', 'hidden');

                // Arrow North
                gnodes.append('path')
                    .attr('class', 'selected')
                    .attr('d', 'M-10 5 L0 -5 L10 5Z')
                    .attr('transform', 'translate(0 -' + d + ')')
                    .attr('visibility', 'hidden');

            }

            function defineNodeEvents() {
                // Event listeners
                // circle
                gnodes.select('circle').on('mouseover', function() {
                    disableSelect(document.getElementById('svg'));

                    if (_mode == ADD_LINK_MODE && this.parentNode != _selected[0]) {
                        d3.select(this.parentNode).classed('selected-node', true);

                        _instance.draw();
                    }
                });

                gnodes.select('circle').on('mouseout', function() {
                    enableSelect(document.getElementById('svg'));

                    if (_mode == ADD_LINK_MODE && this.parentNode != _selected[0]) {
                        d3.select(this.parentNode).classed('selected-node', false);

                        _instance.draw();
                    }

                    d3.event.stopPropagation();
                });

                gnodes.select('circle').on('mousedown', function() {
                    clearSelectedArray();
                    _selected.push(this.parentNode);
                    _mode = MOVE_MODE;

                    _svg.classed('move-mode', true);

                    d3.select(this.parentNode).classed('selected-node', true);

                    _instance.draw();

                    // call the external function
                    _onSelectEvent(this.parentNode.__data__);

                    d3.event.stopPropagation();
                });

                gnodes.select('circle').on('mouseup', function() {
                    if (_mode == ADD_LINK_MODE) {
                        // New Link
                        newLink(this.parentNode);

                        d3.select(this.parentNode).classed('selected-node', false);

                        _svg.classed('add-link-mode', false);

                        _instance.draw();
                    }
                });

                // path
                gnodes.select('path').on('mouseover', function() {
                    disableSelect(document.getElementById('svg'));

                    if (_mode == ADD_LINK_MODE && this.parentNode != _selected[0]) {
                        d3.select(this.parentNode).classed('selected-node', true);

                        _instance.draw();
                    }
                });

                gnodes.select('path').on('mouseout', function() {
                    enableSelect(document.getElementById('svg'));

                    if (_mode == ADD_LINK_MODE && this.parentNode != _selected[0]) {
                        d3.select(this.parentNode).classed('selected-node', false);

                        _instance.draw();
                    }

                    d3.event.stopPropagation();
                });

                gnodes.select('path').on('mousedown', function() {
                    clearSelectedArray();
                    _selected.push(this.parentNode);
                    _mode = MOVE_MODE;

                    _svg.classed('move-mode', true);

                    d3.select(this.parentNode).classed('selected-node', true);

                    _instance.draw();

                    // call the external function
                    _onSelectEvent(this.parentNode.__data__);

                    d3.event.stopPropagation();
                });

                gnodes.select('path').on('mouseup', function() {
                    if (_mode == ADD_LINK_MODE) {
                        // New Link
                        newLink(this.parentNode);

                        d3.select(this.parentNode).classed('selected-node', false);

                        _svg.classed('add-link-mode', false);

                        _instance.draw();
                    }
                });

                //gnodes.select('mouseout').on('mouseover', function() {
                //    enableSelect(document.getElementById('svg'));
                //});

                // path.selected
                gnodes.selectAll('path.selected').on('mouseover', function() {
                    disableSelect(document.getElementById('svg'));
                });

                gnodes.selectAll('path.selected').on('mouseout', function() {
                    enableSelect(document.getElementById('svg'));
                });

                gnodes.selectAll('path.selected').on('mousedown', function() {
                    _mode = ADD_LINK_MODE;

                    _svg.classed('add-link-mode', true);

                    d3.event.stopPropagation();
                });

                function newLink(node) {
                    _instance.addLink({"source":_selected[0].__data__.id,"target":node.__data__.id,"value":1});

                    _mode = NO_MODE;
                }
            }

        };

        _instance.onSelectEvent = function(fn) {
            _onSelectEvent = fn;
        };

        _instance.size = function(w, h) {
            if (w && h) {
                _gridCellWidth = w;
                _gridCellHeight = h;
                _boxPadding = parseInt(w / 2);
            }

            return _instance;
        };

        _instance.nodes = function(v) {
            _nodes = v;

            return _instance;
        };

        _instance.addNode = function(v) {
            _nodes.push(v);

            _instance.draw();

            return _instance;
        };

        _instance.links = function(v) {
            _links = v;

            v.forEach(function(l) {
                l.source = _nodes.filter(function(n) { if (n.id == l.source) return n; })[0];
                l.target = _nodes.filter(function(n) { if (n.id == l.target) return n; })[0];
            });

            return _instance;
        };

        _instance.addLink = function(v) {
            v.source = _nodes.filter(function(n) { if (n.id == v.source) return n; })[0];
            v.target = _nodes.filter(function(n) { if (n.id == v.target) return n; })[0];

            _links.push(v);

            _instance.draw();

            return _instance;
        };

        _instance.groups = function(v) {
            _groups = v;

            _groups.forEach(function(g) {

                if (g.leaves) {
                    for (var i = 0; i < g.leaves.length; i++) {
                        // Get the leaf id and change to respective node object
                        //id = g.id + 'n' + g.leaves[i];
                        //g.leaves[i] = _nodes[g.leaves[i]];
                        var r = _nodes.filter(function (n) {
                            if (n.id == g.leaves[i]) return n;
                        });

                        if (r.length > 0)
                            g.leaves[i] = r[0];
                        else
                            console.error('Invalid Node ' + g.leaves[i] + ' defined in group ' + g.id);
                    }

                    g.originalLeaves = g.leaves;
                }

                var getLeaves = function(group) {

                    if (group.groups) {
                        group.groups.forEach(function(g) {
                            group.leaves = group.leaves.concat(getLeaves(g));
                        });
                    }

                    return group.leaves;
                };

                if (g.groups) {
                    for (var i = 0; i < g.groups.length; i++) {
                        //id = g.id + 'g' + g.groups[i];
                        //g.groups[i] = _groups[g.groups[i]];
                        // Get the group id and change to the respective group object
                        var r = _groups.filter(function(gc) { if (gc.id == g.groups[i]) return gc; });

                        if (r.length > 0)
                            g.groups[i] = r[0];
                        else
                            console.error('Invalid Group ' + g.groups[i] + ' defined in group ' + g.id);
                    }

                    g.leaves = g.leaves.concat(getLeaves(g));
                }
            });

            return _instance;
        };

        _instance.calculatePositions = function() {

            _nodes.forEach(function(n) {
                var x = n.coord[0];
                var y = n.coord[1];

                n.x = _screenRefX + x * _gridCellWidth + Math.round(_gridCellWidth / 2);
                n.y = _screenRefY + y * _gridCellHeight + Math.round(_gridCellHeight / 2);
            });

            var processGroup = function(g) {
                var minX = Number.MAX_SAFE_INTEGER;
                var minY = Number.MAX_SAFE_INTEGER;
                var maxX = Number.MIN_SAFE_INTEGER;
                var maxY = Number.MIN_SAFE_INTEGER;

                g.leaves.forEach(function(n) {
                    minX = Math.min(n.x, minX);
                    minY = Math.min(n.y, minY);
                    maxX = Math.max(n.x, maxX);
                    maxY = Math.max(n.y, maxY);
                });

                g.x = minX;
                g.y = minY;
                g.maxX = maxX;
                g.maxY = maxY;
                g.width = maxX - minX;
                g.height = maxY - minY;
            };

            var checkLevel = function(g) {

                if (!g.groups) {
                    g.level = 1;

                    return 1;
                } else {
                    var maxLevel = 0;

                    g.groups.forEach(function (g) {
                        maxLevel = Math.max(checkLevel(g), maxLevel);
                    });

                    g.groups.forEach(function (g) {
                        g.level = maxLevel;
                    });

                    maxLevel++;

                    return maxLevel;
                }
            };

            _groups.forEach(function(g) {

                if (g.leaves && g.leaves.length > 0) {
                    processGroup(g);

                    g.level = 1;
                }

                if (g.groups && g.groups.length > 0)
                    g.level = checkLevel(g);
            });

            return _instance;
        };

        _instance.convertToCoord = function(x, y) {
            return [Math.round((x - _gridCellWidth / 2) / _gridCellWidth), Math.round((y - _gridCellHeight / 2) / _gridCellHeight)];
        };

        _instance.change = function(x, y) {
            _nodes[0].coord[0] = x;
            _nodes[0].coord[1] = y;
        };

        _instance.moveNodesByXY = function(dx, dy) {

            //_nodes.forEach(function(n) {
            //    n.x = n.x + dx;
            //    n.y = n.y + dy;
            //});

            function updateTranslate() {
                var e = d3.select(this);

                if (e.attr('transform')) {

                    var coord = e.attr('transform').replace('translate(', '').replace(')', '');
                    coord = coord.split(',');
                    coord = [parseInt(coord[0]), parseInt(coord[1])];

                    e.attr('transform', 'translate(' + (coord[0] + dx) + ',' + (coord[1] + dy) + ')');
                } else {
                    e.attr('transform', 'translate(' + (dx) + ',' + (dy) + ')');
                }
            }

            d3.selectAll('g.node').each(updateTranslate);
            d3.selectAll('path.link').each(updateTranslate);
            d3.selectAll('g.group').each(updateTranslate);

            //_nodes.transition()
            //    .attr('transform', function(n) {
            //        return 'translate(' + n.x + ',' + n.y + ')';
            //    });

        };

        /*
        _instance.stepTo = function(dx, dy, excludeNodes) {

            if (!excludeNodes)
                excludeNodes = [];

            _nodes.filter(function(n) {
                return excludeNodes.indexOf(n) == -1
            }).forEach(function(n) {
                n.coord[0] = n.coord[0] + dx;
                n.coord[1] = n.coord[1] + dy;
            });

            _instance.calculatePositions();
        };

        _instance.getBounds = function() {

            var minX = Number.MAX_VALUE;
            var minY = Number.MAX_VALUE;
            var maxX = 0;
            var maxY = 0;

            _nodes.forEach(function(n) {
                minX = Math.min(n.x, minX);
                minY = Math.min(n.y, minY);
                maxX = Math.max(n.x + n.textWidth, maxX);
                maxY = Math.max(n.y, maxY);
            });

            _groups.forEach(function(g) {
                minX = Math.min(g.finalX, minX);
                minY = Math.min(g.finalY, minY);
                maxX = Math.max(g.finalX + g.finalWidth, maxX);
                maxY = Math.max(g.finalY + g.finalHeight, maxY);
            });

            return [minX, minY, parseInt(maxX), parseInt(maxY)];
        };
        */

        //var hashids = new Hashids("my salt");
        //
        //function genHashId() {
        //    function getRandomInt(min, max) {
        //        return Math.floor(Math.random() * (max - min)) + min;
        //    }
        //    var arr = [getRandomInt(1, 100), getRandomInt(1, 1000), getRandomInt(1, 100)];
        //    return hashids.encode(arr);
        //}

        //var metaChar = false;
        //var exampleKey = 16;

        _instance.keyEvent = function(event) {
            var key = event.keyCode || event.which;
            //var keychar = String.fromCharCode(key);

            if (key == 46 && _selected.length > 0) {
                remove();
            }
        };

        _instance.exportData = function() {

            var json = {
                nodes: _nodes.map(function(n) {
                    return {
                        "id": n.id,
                        "name": n.name,
                        "description1": n.description1,
                        "appType": n.appType,
                        "coord": n.coord
                    };
                }),
                links: _links.map(function(l) {
                    return {
                        "source": l.source.id,
                        "target": l.target.id,
                        "value": l.value
                    };
                }),
                groups: _groups.map(function(g) {

                    if (g.groups)
                        return {
                            "id": g.id,
                            "groups": g.groups.map(function(group) { return group.id; }),
                            "leaves": g.originalLeaves.map(function(leaf) { return leaf.id; }),
                            "name": g.name
                        };
                    else
                        return {
                            "id": g.id,
                            "leaves": g.originalLeaves.map(function(leaf) { return leaf.id; }),
                            "name": g.name
                        };
                })
            };

            // Copy the structure
            //var json = JSON.parse(JSON.stringify(result));

            //console.debug(JSON.stringify(removeAttribs(json)));

            console.debug(JSON.stringify(json));

            return JSON.stringify(json);
        };

        function remove() {

            function removeLink(link) {
                var index = _links.indexOf(link);

                _links.splice(index, 1);
            }

            if (_mode == SELECTION_LINK_MODE && _links.length > 0) {
                removeLink(_selected[0].__data__);

                if (_links.length == 0)
                    _mode == NO_MODE;
            } else if (_mode == SELECTION_NODE_MODE && _nodes.length > 0) {
                var n = _selected[0].__data__;
                var index = _nodes.indexOf(n);

                // Remove the node
                _nodes.splice(index, 1);

                // Remove all links associated with this node
                _links.filter(function(l) {
                    return l.source.id == n.id || l.target.id == n.id;
                }).forEach(function(l) { removeLink(l); });

                // Remove all groups associated with this node
                _groups.filter(function(g) {
                    g.leaves.filter(function(leaf) {
                        return leaf.id == n.id;
                    }).forEach(function(gs) {
                        var index = g.leaves.indexOf(gs);

                        if (index >= 0)
                            g.leaves.splice(index, 1);
                    });
                    //
                    //if (gs.length > 0) {
                    //    var index = g.leaves.indexOf(gs[0]);
                    //
                    //    if (index >= 0)
                    //        g.leaves.splice(index, 1);
                    //}

                    return g.leaves.length == 0;
                }).forEach(function(g) {

                    // Remove from parent group
                    _groups.forEach(function(gc) {
                        if (gc.groups) {
                            var r = gc.groups.filter(function(gcc) { return g.id == gcc.id; });

                            if (r.length > 0) {
                                var index = gc.groups.indexOf(r[0]);

                                gc.groups.splice(index, 1);
                            }
                        }
                    });

                    // Remove from main group list
                    var index = _groups.indexOf(g);

                    if (index >= 0)
                        _groups.splice(index, 1);
                });

                if (_nodes.length == 0)
                    _mode == NO_MODE;
            }

            clearSelectedArray();

            _instance.draw();
        }

        function clearSelectedArray() {
            var selectedNode = d3.selectAll('g.selected-node');

            selectedNode
                .classed('selected-node', false);
            selectedNode
                .selectAll('circle.selected').attr('visibility', 'hidden');

            _selected.splice(0, _selected.length);

            var selectedLink = d3.selectAll('path.selected-link');

            selectedLink
                .classed('selected-link', false);

        }

        function disableSelect(el) {
            if (el.addEventListener) {
                el.addEventListener('mousedown', disabler, 'false');
            } else {
                el.attachEvent('onselectstart', disabler);
            }
        }

        function enableSelect(el) {
            if (el.addEventListener) {
                el.removeEventListener('mousedown', disabler, 'false');
            } else {
                el.detachEvent('onselectstart', disabler);
            }
        }

        function disabler(e) {
            if (e.preventDefault) {
                e.preventDefault();
            }
            return false;
        }

        function removeAttribs(obj) {

            function deleteRecursive(data, key) {
                for(var property in data) {
                    if(data.hasOwnProperty(property)) {
                        if(property == key) {
                            delete data[key];
                        }

                        else {
                            if(typeof data[property] === "object") {
                                deleteRecursive(data[property], key);
                            }
                        }
                    }
                }
            }

            ['x', 'y', 'textWidth', 'finalWidth', 'maxX', 'maxY', 'width', 'height', 'level']
                .forEach(function(attrib) { deleteRecursive(obj, attrib); });

            return obj;
        }

        var icons = {
            "angularjs": {
                "d": "M52.864 64h23.28l-12.375-25.877zM63.81 1.026l-59.257 20.854 9.363 77.637 49.957 27.457 50.214-27.828 9.36-77.635-59.637-20.485zm-15.766 73.974l-7.265 18.176-13.581.056 36.608-81.079-.07-.153h-.064l.001-.133.063.133h.14100000000000001l.123-.274v.274h-.124l-.069.153 38.189 81.417-13.074-.287-8.042-18.58-17.173.082",
                "transform": "translate(-16 -16) scale(0.25)"
            },
            "scala": {
                "d": "M5.048,3.692c0,0,13.845-1.385,13.845-3.692v5.539c0,0,0,2.308-13.845,3.692V3.692z M5.106,11.077 c0,0,13.846-1.384,13.846-3.692v5.538c0,0,0,2.309-13.846,3.692V11.077z M5.106,18.461c0,0,13.846-1.384,13.846-3.692v5.539 c0,0,0,2.309-13.846,3.692V18.461z",
                "transform": "translate(-17 -17) scale(1.4)"
            },
            "dotnet": {
                "d": "M109 50h-4.8l-1.2 6h-3.8l1.2-6h-4.9l-1.2 6h-5.3v5h4.4l-.9 4h-3.5v5h2.5l-1.2 6h4.8l1.2-6h3.8l-1.2 6h4.9l1.2-6h5v-5h-4.1l.9-4h3.2v-5h-2.2l1.2-6zm-7.9 15h-3.8l.9-4h3.8l-.9 4zM116.5 32.3c-.6-1.1-1.4-2.1-2.3-2.6l-48.1-27.8c-.8-.5-1.9-.7-3.1-.7-1.2 0-2.3.3-3.1.7l-48.5 27.8c-1.7 1-3.4 3.5-3.4 5.4v55.7c0 1.1.7 2.3 1.4 3.4l.1.1c.5.8 1.3 1.5 2 1.9l48.3 27.9c.8.5 2 .7 3.2.7 1.2 0 2.3-.3 3.1-.7l47.5-27.9c1.7-1 2.4-3.5 2.4-5.4v-55.7c0-.8.4-1.8 0-2.6l.5-.2zm-4.2 2.1c0 .3-.3.5-.3.7v55.7c0 .8-.2 1.7-.4 2l-47.6 27.8c-.1.1-.5.2-1.1.2-.6 0-1-.1-1.1-.2l-48.2-27.8s-.1-.1-.2-.1l-.6-.6c-.4-.7.2-1.1-.8-1.2v-55.7c1-.5.9-1.7 1.4-1.9l48.3-27.9c.1 0 .6-.2 1.2-.2s1 .1 1.1.2l48 27.7.4.9c.1.1-.1.3-.1.4zM63 87.5c-13.5 0-24.5-11-24.5-24.5s11-24.5 24.5-24.5c9.1 0 17.1 5 21.3 12.5l13-7.5c-6.8-11.9-19.6-20-34.3-20-21.8 0-39.5 17.7-39.5 39.5s17.7 39.5 39.5 39.5c14.6 0 27.4-8 34.2-19.8l-12.9-7.6c-4.2 7.4-12.2 12.4-21.3 12.4z",
                "transform": "translate(-19 -19) scale(0.3)"
            },
            "dotnet2": {
                "d": "M910.473 547.467c0 50.7686 -0.0390625 101.498 0.0390625 152.267c10.7148 0.0390625 21.4688 0.0390625 32.2217 0.0390625c0.15625 -47.9238 0 -95.8486 0.078125 -143.772c24.0791 6.38965 48.0801 12.9355 72.1592 19.3252c0.0390625 -26.7285 0.0390625 -53.457 0 -80.2246c-24.04 -6.50684 -48.1582 -12.8965 -72.1592 -19.4424c0 -65.3408 -0.0390625 -130.721 0 -196.061c24.0791 6.38965 48.0801 12.9355 72.1592 19.3252c0.0390625 -26.7285 0 -53.457 0 -80.1855c-24.04 -6.5459 -48.1191 -12.8965 -72.1592 -19.4424c-0.078125 -47.3008 0 -94.6016 -0.0390625 -141.902c-10.7539 0 -21.5459 0 -32.2998 0.0390625c-0.0390625 44.5732 0.0390625 89.1855 0 133.759c-48.0029 -12.8965 -95.9658 -25.793 -143.929 -38.8066c-0.0390625 -50.8076 0.0390625 -101.576 -0.0390625 -152.384h-32.4951c-0.078125 47.9238 0.0390625 95.8877 -0.0390625 143.812c-24.001 -6.38965 -47.9238 -12.9355 -71.9258 -19.2861c-0.0380859 26.8838 -0.0380859 53.7686 0 80.6533c23.9629 6.54492 47.9639 12.8574 71.9258 19.4033c0 65.1846 0.078125 130.408 0 195.593c-24.001 -6.35059 -47.9238 -12.8965 -71.9258 -19.2861c-0.0380859 26.7676 -0.0380859 53.4961 0 80.2246c23.9629 6.5459 47.9639 12.8574 71.9258 19.4033c0.0390625 47.3398 0 94.7188 0.0390625 142.098c10.832 0 21.6631 0 32.5342 -0.0390625c0.0390625 -44.6123 -0.0390625 -89.2637 0 -133.915c48.002 12.8965 95.9648 25.793 143.929 38.8066zM766.583 428.357c-0.078125 -65.2236 -0.0390625 -130.447 -0.0390625 -195.672c48.002 12.9365 95.9648 25.8721 143.929 38.8076c0 65.2236 0.0390625 130.408 -0.0390625 195.632c-47.9639 -12.8574 -95.8877 -25.8711 -143.851 -38.7676zM182.413 661.55c57.042 27.8975 122.46 35.4951 185.151 28.5596c59.5742 -6.70117 117.784 -33.04 158.617 -77.5361c29.6514 -31.7158 49.0547 -71.6133 61.3281 -112.953c-28.5215 -6.7793 -57.042 -13.5586 -85.6016 -20.2607c-15.0781 48.4697 -43.833 96.0439 -90.627 119.383c-52.0156 25.6367 -114.474 23.416 -168.71 6c-60.002 -19.7148 -101.888 -74.0684 -120.278 -132.746c-21.1172 -67.2891 -20.4551 -139.877 -8.37695 -208.802c9.66309 -55.5615 37.0928 -109.642 83.9268 -142.722c51.2744 -37.5986 120.316 -44.1836 180.748 -28.8711c46.2881 11.7666 85.1729 45.2363 106.758 87.4717c12.3125 22.8711 20.2998 47.8076 26.4561 72.9775c28.9883 -7.40332 58.0547 -14.5723 87.0039 -22.209c-16.0918 -61.2109 -45.4697 -121.564 -95.7705 -161.812c-51.8984 -42.6641 -120.317 -60.9385 -186.788 -58.834c-74.6914 0.740234 -153.941 21.4688 -206.736 77.3018c-52.9502 57.3535 -82.4844 133.643 -91.3291 210.556c-7.3252 72.1982 -3.15625 147.357 24.5859 215.113c26.1436 64.6787 77.0293 118.759 139.643 149.384z",
                "transform": "translate(-17 -13) scale(0.035)"
            },
            "dotnet3": {
                "d": "M11.241,15.979c-0.325,0.132-0.72,0.237-1.184,0.317s-0.94,0.12-1.429,0.122c-1.389-0.014-2.465-0.41-3.228-1.185 c-0.764-0.775-1.15-1.843-1.161-3.205c0.029-1.495,0.451-2.61,1.266-3.347s1.849-1.104,3.103-1.103 c0.562,0.005,1.061,0.056,1.498,0.152c0.437,0.097,0.808,0.213,1.114,0.347l0.653-2.496C11.593,5.435,11.161,5.3,10.578,5.18 c-0.582-0.12-1.28-0.184-2.092-0.19C6.353,5.004,4.584,5.633,3.182,6.878S1.052,9.9,1,12.208c0.003,1.959,0.605,3.572,1.809,4.837 c1.204,1.266,2.994,1.92,5.371,1.965c0.835-0.008,1.559-0.074,2.169-0.196c0.61-0.123,1.058-0.255,1.342-0.396L11.241,15.979z M17.061,13.338l0.326-2.475h1.857l-0.306,2.475H17.061z M16.244,18.823l0.51-3.673h1.857l-0.53,3.673h1.836l0.511-3.673 h2.001v-1.812h-1.674l0.306-2.475H23V9.052h-1.634l0.511-3.469h-1.816L19.55,9.052h-1.878l0.511-3.469h-1.796l-0.531,3.469h-2 v1.812h1.715l-0.327,2.475h-1.979v1.812h1.674l-0.531,3.673H16.244z",
                "transform": "translate(-19 -19) scale(1.55)"
            },
            "windows": {
                "d": "M126 1.637l-67 9.834v49.831l67-.534zM1.647 66.709l.003 42.404 50.791 6.983-.04-49.057zM58.467 67.389l.094 49.465 67.376 9.509.016-58.863zM1.61 19.297l.047 42.383 50.791-.289-.023-49.016z",
                "transform": "translate(-13 -13) scale(0.2)"
            },
            "database": {
                "d": "M12,0c5.93,0,10.737,1.272,10.737,2.845v1.261c0,1.569-4.808,2.842-10.737,2.842S1.263,5.675,1.263,4.105V2.842 C1.263,1.272,6.07,0,12,0z M22.737,21.158C22.737,22.728,17.93,24,12,24S1.263,22.728,1.263,21.158v-3.789 c0,1.569,4.808,2.842,10.737,2.842c5.927,0,10.731-1.271,10.737-2.839V21.158z M22.737,15.474c0,1.57-4.808,2.842-10.737,2.842 S1.263,17.043,1.263,15.474v-3.79c0,1.57,4.808,2.842,10.737,2.842c5.927,0,10.731-1.271,10.737-2.84V15.474z M22.737,9.79 c0,1.57-4.808,2.842-10.737,2.842S1.263,11.359,1.263,9.79V6C1.263,7.57,6.07,8.842,12,8.842c5.927,0,10.731-1.271,10.737-2.84V9.79z",
                "transform": "translate(-15 -15) scale(1.25)"
            },
            "mysql": {
                "d": "M0.352,0.596C-0.25,1.198-0.099,1.891,0.954,3.454C1.496,4.267,2.127,5.53,2.369,6.252C2.61,7.004,3.09,8.027,3.421,8.539 c0.602,0.843,0.602,1.023,0.21,2.558c-0.241,0.962-0.331,2.166-0.21,2.918c0.18,1.264,1.203,3.1,1.835,3.311 c0.542,0.179,1.324-0.782,1.354-1.654c0-0.753,0.03-0.783,0.36-0.242c0.572,0.933,2.377,2.917,2.527,2.768 c0.06-0.06-0.331-0.843-0.902-1.715c-0.542-0.902-1.174-2.076-1.414-2.617c-0.331-0.902-0.451-0.963-0.843-0.542 c-0.241,0.24-0.542,0.932-0.631,1.563c-0.241,1.445-0.782,1.625-1.203,0.392c-0.421-1.232-0.421-3.34,0-4.783 c0.3-0.992,0.271-1.264-0.241-2.016C3.932,8.025,3.42,6.942,3.149,6.071c-0.271-0.845-0.903-2.107-1.414-2.77 c-1.173-1.654-1.173-2.257,0.06-2.018c0.511,0.092,1.294,0.452,1.775,0.784c0.451,0.33,1.233,0.601,1.714,0.601 c1.445,0,3.972,1.414,5.807,3.25c1.415,1.413,2.136,2.557,3.671,5.656c1.805,3.67,1.956,3.881,3.069,4.241 c1.324,0.452,4.091,2.136,4.091,2.498c0,0.121-0.693,0.301-1.534,0.36c-2.257,0.242-2.468,0.662-0.993,1.986 c0.692,0.601,1.986,1.533,2.918,2.046L24,23.67l-0.781-0.994c-0.452-0.542-1.385-1.384-2.106-1.836 c-0.722-0.45-1.294-0.931-1.294-1.052s0.511-0.331,1.144-0.421c1.684-0.303,2.165-0.452,2.165-0.752 c0-0.452-3.038-2.738-4.482-3.371c-1.233-0.571-1.384-0.813-2.98-4.091c-1.415-3.009-1.984-3.853-3.79-5.657 c-2.316-2.315-3.911-3.31-5.958-3.61c-0.692-0.12-1.654-0.48-2.076-0.782C2.848,0.351,0.833,0.08,0.351,0.593L0.352,0.596z",
                "transform": "translate(-15 -15) scale(1.3)"
            },
            "browser": {
                "d": "M22.288,1.713H1.716C0.765,1.713,0,2.478,0,3.429v17.142 c0,0.946,0.765,1.716,1.716,1.716h20.572c0.942,0,1.712-0.77,1.712-1.716V3.429C24,2.478,23.23,1.713,22.288,1.713z M8.199,3.003 c0.471,0,0.856,0.379,0.856,0.856c0,0.471-0.385,0.856-0.856,0.856c-0.475,0-0.86-0.385-0.86-0.856 C7.339,3.382,7.724,3.003,8.199,3.003z M5.572,3.003c0.473,0,0.858,0.379,0.858,0.856c0,0.471-0.385,0.856-0.858,0.856 c-0.475,0-0.858-0.385-0.858-0.856C4.714,3.382,5.098,3.003,5.572,3.003z M3,3.003c0.474,0,0.858,0.379,0.858,0.856 C3.857,4.33,3.474,4.715,3,4.715c-0.472,0-0.855-0.385-0.855-0.856C2.145,3.382,2.528,3.003,3,3.003z M22.288,20.571H1.716V6.019 h20.572V20.571z M22.288,4.305H10.286v-0.86h12.002V4.305z",
                "transform": "translate(-16 -16) scale(1.3)"
            },
            "man": {
                "d": "M26.107,22.188c-0.002-1.026-0.72-1.05-1.573-1.396l-4.005-1.6c-0.068-0.025-0.139-0.061-0.209-0.088v-0.002 c-0.708-0.322-1.338-0.771-1.568-1.081l-0.005-0.018l-0.002-0.002c-0.017-0.021-0.036-0.042-0.044-0.056l-0.005-0.018l-0.001-0.004 l-0.013-0.017l0,0c-0.1-0.16-0.213-0.234-0.306-0.194l-0.004,0.001h-0.002l0,0l-0.003,0.002l0,0l-0.014,0.005 c-0.103,0.063-0.083-0.005-0.126-0.121c-0.111-0.301-0.293-0.848-0.319-0.935c-0.044-0.147-0.147,0.238-0.123-0.186l0.047-0.761 c0.071-0.084,0.128-0.15,0.169-0.193c0.262-0.293,0.284-1.085,0.417-1.275c0.126-0.189,0.386-0.233,0.652-1.125 c0.263-0.899,0.575-2.175,0.243-2.194c-0.087-0.006-0.183,0.048-0.277,0.133c0.063-0.328,0.185-1.075,0.211-1.621 c0.041-0.724-0.078-2.583-0.493-3.264c-0.257-0.426-0.775-0.846-1.292-1.175c-0.31-0.198-0.613-0.36-0.872-0.47 c-0.751-0.336-3.134-0.183-3.935,0c-0.915,0.203-1.56,0.777-1.969,1.458c-0.41,0.685-0.596,2.726-0.56,3.45 c0.02,0.321,0.212,0.871,0.261,1.207c0.031,0.176,0.055,0.176,0.079,0.298c-0.038-0.013-0.07-0.021-0.103-0.017 c-0.333,0.018-0.018,1.295,0.242,2.193c0.267,0.893,0.524,0.936,0.655,1.125c0.131,0.189,0.151,0.981,0.412,1.276 c0.038,0.044,0.104,0.116,0.178,0.203l0.054,0.626l0.084,0.339c-0.038-0.095-0.117-0.164-0.154-0.027 c-0.115,0.345-0.223,0.683-0.337,1.026c-0.012-0.019-0.033-0.025-0.049-0.025c-0.113-0.105-0.257-0.017-0.388,0.211 c-0.198,0.327-0.854,0.802-1.613,1.138L9.436,19.06L9.424,19.1L9.42,19.12c-0.058,0.023-0.117,0.048-0.183,0.071l-3.999,1.6 c-0.855,0.348-1.573,0.37-1.574,1.396L3,25.665h24L26.107,22.188z",
                "transform": "translate(-20 -20) scale(1.35)"
            },
            "rabbitmq": {
                "d": "M 18.15625 16 C 16.959881 16 16 16.959881 16 18.15625 L 16 43.15625 L 16 52.84375 L 16 77.84375 C 16 79.040119 16.959881 80 18.15625 80 L 77.84375 80 C 79.040119 80 80 79.040119 80 77.84375 L 80 43.15625 C 80 41.959881 79.040119 41 77.84375 41 L 53 41 L 53 18.15625 C 53 16.959881 52.040119 16 50.84375 16 L 43.15625 16 C 41.959881 16 41 16.959881 41 18.15625 L 41 41 L 28 41 L 28 18.15625 C 28 16.959881 27.040119 16 25.84375 16 L 18.15625 16 z M 57.15625 55 L 64.84375 55 C 66.040119 55 67 55.959881 67 57.15625 L 67 64.84375 C 67 66.040119 66.040119 67 64.84375 67 L 57.15625 67 C 55.959881 67 55 66.040119 55 64.84375 L 55 57.15625 C 55 55.959881 55.959881 55 57.15625 55 z",
                "transform": "translate(-22 -22) scale(0.45)"
            }
        };

        return _instance;
    };

    return guidedGraph;
})(guidedGraph || (guidedGraph = {}));
