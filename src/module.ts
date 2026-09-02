import { PanelPlugin } from '@grafana/data';
import { MaintenancePanelOptions, defaultMaintenancePanelOptions } from './types';
import { MaintenancePanel } from './components/MaintenancePanel';

export const plugin = new PanelPlugin<MaintenancePanelOptions>(MaintenancePanel).setPanelOptions((builder) => {
  return builder.addTextInput({
    path: 'datasourceName',
    name: 'Datasource name',
    description:
      'Name of the Grafana datasource (kniepdennis-neo4j-datasource, pointed at Memgraph) this panel reads ' +
      'and writes through — the same connection used in dashboards’ Queries tab. Must match exactly as ' +
      'configured under Connections → Data sources.',
    defaultValue: defaultMaintenancePanelOptions.datasourceName,
    category: ['TradeFlow'],
  });
});
