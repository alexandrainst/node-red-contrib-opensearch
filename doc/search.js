module.exports = function (RED) {
    const U = require('../utils');
    const M = require('mustache');
    M.escape = function (t) { return JSON.stringify(t); };

    function Search(n) {
        RED.nodes.createNode(this, n);
        this.conn = RED.nodes.getNode(n.connection);
        this.conf = n;
        const node = this;

        this.on('input', async function (msg) {
            const data = U.prepData(node, msg);

            const params = {
                index: M.render(n.index, data),
                size: 200,
                sort: M.render(n.sort, data),
                _source_includes: M.render(n.composition, data),
                version: true,
            };
            const query = M.render(n.query, data);
            const limit = M.render(n.limit, data);

            for (const k in params) {
                if (!params[k]) { delete params[k]; }
            }

            if (typeof params._source_includes === 'string') {
                params._source_includes = params._source_includes.split(',');
            }

            if (query) {
                params.body = {
                    query: {
                        constant_score: {
                            filter: null,
                        },
                    },
                };

                try {
                    params.body.query.constant_score.filter = JSON.parse(query);
                } catch (e) {
                    params.body.query.constant_score.filter = {
                        query_string: {
                            query,
                        },
                    };
                }
            }

            if (!U.keyHasValue(node, params, 'index')) return;

            const client = node.conn.client();
            node.status({ fill: 'blue', shape: 'dot', text: 'searching' });
            const scrollSearch = client.helpers.scrollSearch(params);
            let count = 0;

            // TODO: no-label: Avoid use of label
            SCROLL: for await (const res of scrollSearch) {
                if (!(res.statusCode == 200 || res.statusCode == 201)) {
                    node.status({ fill: 'red', shape: 'ring', text: 'failed' });
                    msg.es = {
                        index: params.index,
                        docId: null,
                        docVer: null,
                        found: false,
                        result: 'failed',
                        response: res,
                    };
                    node.send([null, msg]);
                }

                // TODO would love to pass status info, but not supported yet.
                // var info = {
                //     took: res.body.took,
                //     shards: res.body._shards,
                //     hits: res.body.hits.total
                // }
                node.status({ fill: 'green', shape: 'ring', text: 'receiving' });

                const hits = res.body.hits.hits;
                if (!Array.isArray(hits)) continue SCROLL;
                delete res.body.hits.hits;

                for (const d in hits) {
                    if (++count > limit && limit > 0) { break SCROLL; }

                    node.status({ fill: 'green', shape: 'dot', text: 'found' });
                    msg.payload = hits[d]._source;
                    delete hits[d]._source;
                    msg.es = {
                        index: hits[d]._index,
                        docId: hits[d]._id,
                        docVer: hits[d]._version,
                        found: true,
                        result: 'found',
                        response: { ...res.body, ...hits[d] },
                    };
                    node.send([msg, null]);
                }
            }

            if (count < 1) {
                node.status({ fill: 'yellow', shape: 'ring', text: 'nothing found' });
                node.send([null, {
                    es: {
                        index: params.index,
                        docId: null,
                        docVer: null,
                        found: false,
                        result: 'failed',
                        response: null,
                    },
                }]);
            }

            U.slateStatusClear(node);
        });
    }
    RED.nodes.registerType('es-doc-search', Search);
};
