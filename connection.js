module.exports = function (RED) {
    const Y = require('yaml');
    const { Client } = require('@opensearch-project/opensearch');

    function OsConnectionNode(n) {
        RED.nodes.createNode(this, n);
        const node = this;
        this.conf = n;
        let auth;

        switch (this.credentials.cred) {
            case '':
                auth = null;
                break;
            case 'basic':
                auth = {
                    username: this.credentials.ident,
                    password: this.credentials.secret,
                };
                break;
            case 'apikey_b64':
                auth = { apiKey: this.credentials.secret };
                break;
            case 'apikey_obj':
                auth = {
                    apiKey: {
                        id: this.credentials.ident,
                        api_key: this.credentials.secret,
                    },
                };
                break;
            case 'bearer':
                auth = { bearer: this.credentials.secret };
                break;
            default:
                node.error('Invalid credential');
        }

        let params = {};

        if (n.nodes) { params.nodes = n.nodes.split(' '); }

        if (auth && auth !== '') { params.auth = auth; }

        if (n.advConfig) {
            try {
                const ac = Y.parse(n.advConfig);
                if (ac) { params = { ...ac, ...params }; }
            } catch (e) {
                this.error(e);
            }
        }

        if (!n.verifyservercert) {
            if (!params.ssl) {
                params.ssl = {};
            }
            params.ssl.rejectUnauthorized = false;
        }

        this._conn = new Client(params);

        this.client = function (c) {
            return this._conn.child(c);
        };
    }
    RED.nodes.registerType('os-connection', OsConnectionNode, {
        credentials: {
            cred: { type: 'text' },
            ident: { type: 'text' },
            secret: { type: 'password' },
        },
    });
};
