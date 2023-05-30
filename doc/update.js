module.exports = function (RED) {
    const U = require('../utils');
    const Y = require('yaml');
    const M = require('mustache');
    M.escape = function (t) { return JSON.stringify(t); };

    function Update(n) {
        RED.nodes.createNode(this, n);
        this.conn = RED.nodes.getNode(n.connection);
        this.conf = n;
        const node = this;

        this.on('input', function (msg) {
            const data = U.prepData(node, msg);

            const params = {
                index: M.render(n.index, data),
                id: M.render(n.docId, data),
                body: M.render(n.content, data),
            };

            for (const k in params) {
                if (!params[k]) { delete params[k]; }
            }

            if (!U.keyHasValue(node, params, 'index')) return;
            if (!U.keyHasValue(node, params, 'id')) return;

            try {
                params.body = Y.parse(params.body);
            } catch (e) {
                node.warn(e);
            }

            if (msg.payload.lang === 'painless' && Object.prototype.hasOwnProperty.call(msg, 'source')) {
                params.script = msg.payload;
            } else {
                params.body = {
                    doc: msg.payload,
                };
            }

            const client = node.conn.client();
            node.status({ fill: 'blue', shape: 'ring', text: 'updating' });
            client.update(params).then(function (res) {
                node.status({ fill: 'green', shape: 'dot', text: res.result });
                msg.es = {
                    index: res._index,
                    docId: res._id,
                    docVer: res._version,
                    updated: (res.result === 'updated'),
                    result: res.result,
                    response: res,
                };
                node.send([msg, null]);
            }, function (err) {
                node.status({ fill: 'red', shape: 'ring', text: 'failed' });
                msg.es = {
                    index: params.index,
                    docId: params.id,
                    docVer: null,
                    updated: false,
                    result: 'failed',
                    response: err.meta.body,
                };
                node.send([null, msg]);
            });

            U.slateStatusClear(node);
        });
    }
    RED.nodes.registerType('os-doc-update', Update);
};
