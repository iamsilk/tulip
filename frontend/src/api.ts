
// todo in the future this should be something autogenerated with typescript type generation.

import { atom, useAtom } from "jotai"

export interface Flow {
    _id: Id
    src_port: number
    dst_port: number
    src_ip: string
    dst_ip: string
    time: number
    duration: number
    // TODO: get this from backend instead of hacky work around
    service_tag: string
    num_packets: number
    parent_id: Id
    child_id: Id
    tags: string[]
    suricata: number[]
    filename: string
}

export interface FullFlow extends Flow {
    signatures: Signature[]
    flow: FlowData[]
}

export interface Id {
    $oid: string
}

export interface FlowData {
    from: string
    data: string
    time: number
}

export interface Signature {
    id: number
    msg: string
    action: string
}

// TODO pagination WTF
export interface FlowsQuery {
    // Text filter
    "flow.data"?: string;
    // Service filter
    // todo why not use service name here?
    service: string;
    dst_ip?: string;
    dst_port?: number;
    from_time?: string;
    to_time?: string;
    tags: string[];
}

export type Service = {
    ip: string;
    port: number;
    name: string;
};



class TulipApi {
    private API_ENDPOINT = "/api";

    async getServices() {
        const response = await fetch(`${this.API_ENDPOINT}/services`);
        return (await response.json()) as Service[];
    }

    async _getFlows(query: FlowsQuery, destToService: any) {

        // HACK: make starred look like a tag
        let tags = query.tags;
        const hacky_query = {
            ...query,
            tags: tags.length > 0 ? tags : undefined,
        }
        // END HACK

        // todo rename this endpoint
        const response = await fetch(`${this.API_ENDPOINT}/query`, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(hacky_query),
        });
        const res = await response.json() as Flow[]

        // HACK for service in flow
        const hack = res.map(flow => ({ ...flow, service_tag: destToService(flow.dst_ip, flow.dst_port).name }))
        return hack;
    }

    async getSignature(id: number) {
        const response = await fetch(`${this.API_ENDPOINT}/signature/${id}`);
        return (await response.json()) as Signature[];
    }

    async getTags() {
        const response = await fetch(`${this.API_ENDPOINT}/tags`);
        const tags = await response.json();

        return tags;
    }

    async getFlow(id: string) {
        const response = await fetch(`${this.API_ENDPOINT}/flow/${id}`);
        return (await response.json()) as FullFlow;
    }


    async starFlow(id: string, star: boolean) {
        const response = await fetch(`${this.API_ENDPOINT}/star/${id}/${star ? "1" : "0"}`);
        return await response.text()
    }

    async toSinglePythonRequest(body: string, id: string, tokenize: boolean) {
        const response = await fetch(`${this.API_ENDPOINT}/to_single_python_request?tokenize=${tokenize ? "1" : "0"}&id=${id}`, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain;charset=UTF-8"
            },
            body
        });
        return await response.text()
    }

    async toFullPythonRequest(id: string) {
        const response = await fetch(`${this.API_ENDPOINT}/to_python_request/${id}`);
        return await response.text()
    }

    async toPwnTools(id: string) {
        const response = await fetch(`${this.API_ENDPOINT}/to_pwn/${id}`);
        return await response.text();
    }

    getDownloadLink(path: string) {
        return `${this.API_ENDPOINT}/download/?file=${path}`;
    }

}

// Singleton
const api = new TulipApi();

const serviceAtom = atom(async (get) => {
    console.log("Fetching services");
    return await api.getServices();
});


export const useTulip = function () {
    // Limitation: fetches services only once at start, need to refresh page if service list updates
    const [services] = useAtom(serviceAtom);

    // HACK: map dest to service, could be done in server I guess
    const destToService = function (ip: string, port: number): Service {
        return services.find(s => s.ip === ip && s.port === port) ?? { name: "unknown", port: 0, ip: "" }
    }

    async function getFlows(query: FlowsQuery) {
        return await api._getFlows(query, destToService);
    }


    return { services, getFlows, api };
}