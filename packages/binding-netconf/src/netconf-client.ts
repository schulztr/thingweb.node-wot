/*******************************************************************************
 * Copyright (c) 2022 Contributors to the Eclipse Foundation
 *
 * See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0, or the W3C Software Notice and
 * Document License (2015-05-13) which is available at
 * https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document.
 *
 * SPDX-License-Identifier: EPL-2.0 OR W3C-20150513
 ********************************************************************************/

/**
 * Netconf protocol binding
 */
import { ProtocolClient, Content, ProtocolHelpers } from "@node-wot/core";
import { NetconfForm } from "./netconf";
import * as TD from "@node-wot/td-tools";
import * as AsyncNodeNetcon from "./async-node-netconf";
import Url from "url-parse";
import { Readable } from "stream";
import { Subscription } from "rxjs/Subscription";

const DEFAULT_TARGET = "candidate";

export default class NetconfClient implements ProtocolClient {
    private client: AsyncNodeNetcon.Client;
    private credentials: unknown;
    constructor() {
        this.client = new AsyncNodeNetcon.Client();
        this.credentials = null;
    }

    public toString(): string {
        return "[NetconfClient]";
    }

    public async readResource(form: NetconfForm): Promise<Content> {
        const url = new Url(form.href);
        const ipAddress = url.hostname;
        const port = parseInt(url.port);
        const xpathQuery = url.pathname;
        const method = form["nc:method"] ? form["nc:method"] : "GET-CONFIG"; // default method
        const NSs = form["nc:NSs"] || {};
        const target = form["nc:target"] || DEFAULT_TARGET;

        const contentType = "application/yang-data+xml";

        if (this.client.getRouter() === null) {
            try {
                await this.client.initializeRouter(ipAddress, port, this.credentials);
                await this.client.openRouter();
            } catch (err) {
                this.client.deleteRouter();
                throw err;
            }
        }

        let result = await this.client.rpc(xpathQuery, method, NSs, target);
        result = JSON.stringify(result);

        return new Promise<Content>((resolve, reject) => {
            resolve({ type: contentType, body: Readable.from(Buffer.from(result)) });
        });
    }

    public async writeResource(form: NetconfForm, content: Content): Promise<void> {
        const body = await ProtocolHelpers.readStreamFully(content.body);
        let payload = content ? JSON.parse(body.toString()) : {};
        const url = new Url(form.href);
        const ipAddress = url.hostname;
        const port = parseInt(url.port);
        const xpathQuery = url.pathname;
        const method = form["nc:method"] ? form["nc:method"] : "EDIT-CONFIG";
        let NSs = form["nc:NSs"] || {};
        const target = form["nc:target"] || DEFAULT_TARGET;

        if (this.client.getRouter() === null) {
            try {
                await this.client.initializeRouter(ipAddress, port, this.credentials);
                await this.client.openRouter();
            } catch (err) {
                this.client.deleteRouter();
                throw err;
            }
        }

        NSs = { ...NSs, ...payload.NSs };
        payload = payload.payload;
        await this.client.rpc(xpathQuery, method, NSs, target, payload);
        return new Promise<void>((resolve, reject) => {
            resolve(undefined);
        });
    }

    public async invokeResource(form: NetconfForm, content: Content): Promise<Content> {
        const body = await ProtocolHelpers.readStreamFully(content.body);
        let payload = content ? JSON.parse(body.toString()) : {};
        const url = new Url(form.href);
        const ipAddress = url.hostname;
        const port = parseInt(url.port);
        const xpathQuery = url.pathname;
        const method = form["nc:method"] ? form["nc:method"] : "RPC";
        let NSs = form["nc:NSs"] || {};
        const target = form["nc:target"] || DEFAULT_TARGET;
        let result: string;

        if (this.client.getRouter() === null) {
            try {
                await this.client.initializeRouter(ipAddress, port, this.credentials);
                await this.client.openRouter();
            } catch (err) {
                this.client.deleteRouter();
                throw err;
            }
        }
        try {
            NSs = { ...NSs, ...payload.NSs };
            payload = payload.payload;
            result = await this.client.rpc(xpathQuery, method, NSs, target, payload);
            result = JSON.stringify(result);
        } catch (err) {
            console.debug("[binding-netconf]", err);
            throw err;
        }

        const contentType = "application/yang-data+xml";
        return new Promise<Content>((resolve, reject) => {
            resolve({ type: contentType, body: Readable.from(result) });
        });
    }

    public unlinkResource(form: NetconfForm): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            reject(new Error(`NetconfClient does not implement unlink`));
        });
    }

    public async subscribeResource(
        form: NetconfForm,
        next: (content: Content) => void,
        error?: (error: Error) => void,
        complete?: () => void
    ): Promise<Subscription> {
        const unimplementedError = new Error(`NetconfClient does not implement subscribe`);
        error(unimplementedError);
        throw unimplementedError;
    }

    public async start(): Promise<void> {
        // do nothing
    }

    public async stop(): Promise<void> {
        // do nothing
    }

    public setSecurity(metadata: Array<TD.SecurityScheme>, credentials?: any): boolean {
        if (metadata === undefined || !Array.isArray(metadata) || metadata.length === 0) {
            console.warn("[binding-netconf]", `NetconfClient without security`);
            return false;
        }
        if (!credentials || (!credentials.password && !credentials.privateKey)) {
            throw new Error(`Both password and privateKey missing inside credentials`);
        }

        this.credentials = credentials;
        return true;
    }
}
