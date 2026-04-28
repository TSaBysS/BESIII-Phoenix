import { Object3D } from 'three';
/**
 * Physics objects that make up an event in CMS that are not a part of {@link PhoenixObjects}.
 */
export declare class CMSObjects {
    /**
     * Process the Muon Chamber from the given parameters.
     * and get it as a geometry.
     * @param muonChamberParams Parameters of the Muon Chamber.
     * @returns Muon Chamber object.
     */
    static getMuonChamber(muonChamberParams: any): Object3D;
}
