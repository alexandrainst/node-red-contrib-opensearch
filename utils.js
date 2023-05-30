module.exports = {
    deDot: function (obj) {
        for (const k in obj) {
            if (k.indexOf('.') > 0) {
                const nk = k.replaceAll('.', '~');
                delete Object.assign(obj, { [nk]: obj[k] })[k];
            }
            if (obj[k] instanceof Object) {
                this.deDot(obj[k]);
            }
        }
    },

    keyHasValue: function (node, params, key) {
        const name = node.name || node.conf.name || node.type;

        if (typeof params[key] !== 'string' || params[key].length < 1) {
            node.status({ fill: 'red', shape: 'ring', text: 'input-error: ' + key });

            const err = name + ' is missing ' + key;
            node.error(err, {
                es: {
                    node: name,
                    error: err,
                },
            });

            return false;
        }
        return true;
    },

    slateStatusClear: function (node) {
        clearTimeout(node.pending_status_clear);
        node.pending_status_clear = setTimeout(() => {
            node.status({});
        }, 60000);
    },

    prepData: function (node, msg) {
        const data = { ...msg };

        if (node.conf.loadContexts) {
            data._ = {};
            const c = node.context();
            const lc = node.conf.loadContexts.split(',');
            for (const i in lc) {
                const k = lc[i].trim();
                data._[k] = c.get(k) || c.flow.get(k) || c.global.get(k);
            }
        }
        return data;
    },
};
