type AuditWorkspaceConfigSnapshotPanelProps = {
  configWebEntry: string
  configApiBaseUrl: string
  configGatewayUrl: string
}

export default function AuditWorkspaceConfigSnapshotPanel({
  configWebEntry,
  configApiBaseUrl,
  configGatewayUrl,
}: AuditWorkspaceConfigSnapshotPanelProps) {
  return (
    <div className="api-panel api-panel--bottom">
      <span className="section-label">配置快照</span>
      <div className="contract-list">
        <code>{configWebEntry}</code>
        <code>{configApiBaseUrl}</code>
        <code>{configGatewayUrl}</code>
      </div>
    </div>
  )
}
