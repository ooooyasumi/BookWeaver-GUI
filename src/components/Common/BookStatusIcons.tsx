import { Tooltip } from 'antd'
import { TagsOutlined, PictureOutlined, CloudUploadOutlined, CloseCircleOutlined } from '@ant-design/icons'

interface BookStatusIconsProps {
  metadataUpdated?: boolean
  metadataError?: string | null
  coverUpdated?: boolean
  coverError?: string | null
  uploaded?: boolean
  uploadError?: string | null
}

const iconStyle = (active: boolean, error?: boolean) => ({
  fontSize: 14,
  color: error ? '#ff4d4f' : active ? '#52c41a' : 'var(--text-quaternary, rgba(0,0,0,0.15))',
  transition: 'color 0.2s',
})

export function BookStatusIcons({
  metadataUpdated,
  metadataError,
  coverUpdated,
  coverError,
  uploaded,
  uploadError,
}: BookStatusIconsProps) {
  const hasMetadataError = !metadataUpdated && !!metadataError
  const hasCoverError = !coverUpdated && !!coverError
  const hasUploadError = !uploaded && !!uploadError

  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
      <Tooltip title={hasMetadataError ? `元数据更新失败: ${metadataError}` : metadataUpdated ? '元数据已更新' : '元数据未更新'}>
        {hasMetadataError ? (
          <CloseCircleOutlined style={iconStyle(false, true)} />
        ) : (
          <TagsOutlined style={iconStyle(!!metadataUpdated)} />
        )}
      </Tooltip>
      <Tooltip title={hasCoverError ? `封面更新失败: ${coverError}` : coverUpdated ? '封面已更新' : '封面未更新'}>
        {hasCoverError ? (
          <CloseCircleOutlined style={iconStyle(false, true)} />
        ) : (
          <PictureOutlined style={iconStyle(!!coverUpdated, hasCoverError)} />
        )}
      </Tooltip>
      <Tooltip title={hasUploadError ? `上传失败: ${uploadError}` : uploaded ? '已上传' : '未上传'}>
        {hasUploadError ? (
          <CloseCircleOutlined style={iconStyle(false, true)} />
        ) : (
          <CloudUploadOutlined style={iconStyle(!!uploaded, hasUploadError)} />
        )}
      </Tooltip>
    </span>
  )
}
