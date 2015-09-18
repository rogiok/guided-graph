var guidedGraph;

(function (guidedGraph) {

    guidedGraph.adaptor = function () {
        var adaptor = {};
        var nodes = [];
        var links = [];
        var groups = [];
        var width = 20;
        var height = 20;

        adaptor.size = function(w, h) {
            width = w;
            height = h;

            return adaptor;
        };

        adaptor.nodes = function(v) {
            nodes = v;

            var c = 1;

            v.forEach(function(n) {
                n.id = c;
                c++;
            });

            return adaptor;
        };

        adaptor.links = function(v) {
            links = v;

            v.forEach(function(l) {
                l.source = nodes[l.source];
                l.target = nodes[l.target];
            });

            return adaptor;
        };

        adaptor.groups = function(v) {
            groups = v;

            v.forEach(function(g) {
                var id = "";

                if (g.leaves)
                    for (var i = 0; i < g.leaves.length; i++) {
                        id = id + 'n' + g.leaves[i];
                        g.leaves[i] = nodes[g.leaves[i]];
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
                        id = id + 'g' + g.groups[i];
                        g.groups[i] = groups[g.groups[i]];
                    }

                    g.leaves = g.leaves.concat(getLeaves(g));
                }

                g.id = id;
            });

            return adaptor;
        };

        adaptor.calculatePositions = function() {

            nodes.forEach(function(node) {
                var x = node.coord[0];
                var y = node.coord[1];

                node.x = x * width + Math.round(width / 2);
                node.y = y * height + Math.round(height / 2);
            });

            var processGroup = function(group) {
                var minX = Number.MAX_VALUE;
                var minY = Number.MAX_VALUE;
                var maxX = 0;
                var maxY = 0;

                group.leaves.forEach(function(n) {
//                        if (n.x < minX)
                    minX = Math.min(n.x, minX);
//                        if (n.y < minY)
                    minY = Math.min(n.y, minY);
//                        if (n.x > maxX)
                    maxX = Math.max(n.x, maxX);
//                        if (n.y > maxY)
                    maxY = Math.max(n.y, maxY);
                });

                group.x = minX;
                group.y = minY;
                group.maxX = maxX;
                group.maxY = maxY;
                group.width = maxX - minX;
                group.height = maxY - minY;
            };

            var checkLevel = function(group) {

                if (!group.groups) {
                    group.level = 1;

                    return 1;
                } else {
                    var maxLevel = 0;

                    group.groups.forEach(function (g) {
                        maxLevel = Math.max(checkLevel(g), maxLevel);
                    });

                    group.groups.forEach(function (g) {
                        g.level = maxLevel;
                    });

                    maxLevel++;

                    return maxLevel;
                }
            };

            groups.forEach(function(group) {

                if (group.leaves && group.leaves.length > 0) {
                    processGroup(group);

                    group.level = 1;
                }

                if (group.groups && group.groups.length > 0)
                    group.level = checkLevel(group);
            });

            return adaptor;
        };

        adaptor.convertToCoord = function(x, y) {
            return [Math.round((x - width / 2) / width), Math.round((y - height / 2) / height)];
        };

        adaptor.change = function(x, y) {
            nodes[0].coord[0] = x;
            nodes[0].coord[1] = y;
        };

        return adaptor;
    };

    return guidedGraph;
})(guidedGraph || (guidedGraph = {}));
