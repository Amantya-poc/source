import TileLayer from 'ol/layer/Tile';
import TileWMS from 'ol/source/TileWMS';
import { GEOSERVER_CONFIG } from '../config/geoserver.config';

export function createGeoServerBaseLayer(): TileLayer {
  return new TileLayer({
    source: new TileWMS({
      url: `${GEOSERVER_CONFIG.url}/wms`,
      params: {
        LAYERS: GEOSERVER_CONFIG.layer,
        TILED: true,
        FORMAT: 'image/png',
        VERSION: '1.1.1',
      },
      serverType: 'geoserver',
    }),
  });
}
