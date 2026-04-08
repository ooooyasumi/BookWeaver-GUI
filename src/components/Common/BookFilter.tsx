import { Select, Tag } from 'antd'
import { TagsOutlined, PictureOutlined, CloudUploadOutlined, CloseCircleOutlined } from '@ant-design/icons'

// ─── 筛选键类型 ─────────────────────────────────────────────────────────────

export type FilterKey =
  | 'metadataNotUpdated' | 'metadataUpdated' | 'metadataError'
  | 'coverNotUpdated' | 'coverUpdated' | 'coverError'
  | 'uploadNotUploaded' | 'uploadUploaded' | 'uploadError'

// ─── 筛选选项定义 ───────────────────────────────────────────────────────────

const FILTER_OPTIONS: { key: FilterKey; label: string; icon: React.ReactNode; color: string; group: string }[] = [
  // 元数据
  { key: 'metadataNotUpdated', label: '元数据未更新', icon: <TagsOutlined />, color: '#faad14', group: '元数据' },
  { key: 'metadataUpdated', label: '元数据已更新', icon: <TagsOutlined />, color: '#52c41a', group: '元数据' },
  { key: 'metadataError', label: '元数据更新失败', icon: <CloseCircleOutlined />, color: '#ff4d4f', group: '元数据' },
  // 封面
  { key: 'coverNotUpdated', label: '封面未更新', icon: <PictureOutlined />, color: '#faad14', group: '封面' },
  { key: 'coverUpdated', label: '封面已更新', icon: <PictureOutlined />, color: '#52c41a', group: '封面' },
  { key: 'coverError', label: '封面更新失败', icon: <CloseCircleOutlined />, color: '#ff4d4f', group: '封面' },
  // 上传
  { key: 'uploadNotUploaded', label: '未上传', icon: <CloudUploadOutlined />, color: '#faad14', group: '上传' },
  { key: 'uploadUploaded', label: '已上传', icon: <CloudUploadOutlined />, color: '#52c41a', group: '上传' },
  { key: 'uploadError', label: '上传失败', icon: <CloseCircleOutlined />, color: '#ff4d4f', group: '上传' },
]

// ─── 分组选项（用于 Select） ─────────────────────────────────────────────────

const GROUPED_OPTIONS = [
  {
    label: '元数据',
    options: FILTER_OPTIONS.filter(o => o.group === '元数据').map(o => ({
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: o.color }}>{o.icon}</span>
          {o.label}
        </span>
      ),
      value: o.key,
    })),
  },
  {
    label: '封面',
    options: FILTER_OPTIONS.filter(o => o.group === '封面').map(o => ({
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: o.color }}>{o.icon}</span>
          {o.label}
        </span>
      ),
      value: o.key,
    })),
  },
  {
    label: '上传',
    options: FILTER_OPTIONS.filter(o => o.group === '上传').map(o => ({
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: o.color }}>{o.icon}</span>
          {o.label}
        </span>
      ),
      value: o.key,
    })),
  },
]

// ─── 匹配逻辑 ───────────────────────────────────────────────────────────────

export interface BookWithAllStatus {
  metadataUpdated?: boolean
  metadataError?: string | null
  coverUpdated?: boolean
  coverError?: string | null
  uploaded?: boolean
  uploadError?: string | null
  [key: string]: any
}

export function matchesFilter(book: BookWithAllStatus, filters: Set<FilterKey>): boolean {
  if (filters.size === 0) return true
  for (const f of filters) {
    switch (f) {
      case 'metadataNotUpdated':
        if (book.metadataUpdated) return false
        break
      case 'metadataUpdated':
        if (!book.metadataUpdated || book.metadataError) return false
        break
      case 'metadataError':
        if (!book.metadataError) return false
        break
      case 'coverNotUpdated':
        if (book.coverUpdated || book.coverError) return false
        break
      case 'coverUpdated':
        if (!book.coverUpdated || book.coverError) return false
        break
      case 'coverError':
        if (!book.coverError) return false
        break
      case 'uploadNotUploaded':
        if (book.uploaded) return false
        break
      case 'uploadUploaded':
        if (!book.uploaded || book.uploadError) return false
        break
      case 'uploadError':
        if (!book.uploadError) return false
        break
    }
  }
  return true
}

// ─── BookFilter 组件 ─────────────────────────────────────────────────────────

interface BookFilterProps {
  filters: Set<FilterKey>
  onChange: (filters: Set<FilterKey>) => void
  style?: React.CSSProperties
}

export function BookFilter({ filters, onChange, style }: BookFilterProps) {
  return (
    <Select
      mode="multiple"
      placeholder="筛选状态"
      value={Array.from(filters)}
      onChange={(vals) => onChange(new Set(vals as FilterKey[]))}
      options={GROUPED_OPTIONS}
      style={{ minWidth: 240, ...style }}
      maxTagCount={2}
      maxTagPlaceholder={(omitted) => `+${omitted.length}`}
      allowClear
      listHeight={400}
      popupMatchSelectWidth={false}
      tagRender={({ label, closable, onClose }) => {
        const opt = FILTER_OPTIONS.find(o => o.label === label)
        return (
          <Tag
            closable={closable}
            onClose={onClose}
            style={{ marginRight: 4 }}
            icon={opt?.icon}
            color={opt?.color ? `${opt.color}20` : undefined}
          >
            {label}
          </Tag>
        )
      }}
    />
  )
}

// 导出供外部使用
export { FILTER_OPTIONS }
