import { Button, Select, Space } from 'antd'
import { LeftOutlined, RightOutlined, DoubleLeftOutlined, DoubleRightOutlined } from '@ant-design/icons'

const PAGE_SIZE_OPTIONS_WITH_ALL = [20, 50, 100, 0] // 0 = 显示全部

interface PaginationBarProps {
  total: number
  pageOffset: number
  pageLimit: number
  onPageChange: (offset: number) => void
  onPageSizeChange: (limit: number) => void
}

export function PaginationBar({
  total,
  pageOffset,
  pageLimit,
  onPageChange,
  onPageSizeChange,
}: PaginationBarProps) {
  const isAll = pageLimit === 0
  const effectiveLimit = isAll ? total : pageLimit
  const currentPage = effectiveLimit > 0 ? Math.floor(pageOffset / effectiveLimit) + 1 : 1
  const totalPages = effectiveLimit > 0 ? Math.ceil(total / effectiveLimit) : 1

  const start = total > 0 ? pageOffset + 1 : 0
  const end = isAll ? total : Math.min(pageOffset + effectiveLimit, total)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 0 4px',
      borderTop: '1px solid var(--border-light)',
    }}>
      <Space>
        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          {total > 0 ? `显示 ${start}-${end} / ${total} 本` : `共 ${total} 本`}
        </span>
        <Select
          value={pageLimit}
          onChange={(value) => {
            onPageSizeChange(value)
          }}
          style={{ width: 120 }}
        >
          {PAGE_SIZE_OPTIONS_WITH_ALL.map(size =>
            size === 0
              ? <Select.Option key={0} value={0}>全部</Select.Option>
              : <Select.Option key={size} value={size}>{size} 本/页</Select.Option>
          )}
        </Select>
      </Space>

      {!isAll && (
        <Space>
          <Button
            size="small"
            icon={<DoubleLeftOutlined />}
            disabled={pageOffset === 0}
            onClick={() => onPageChange(0)}
          />
          <Button
            size="small"
            icon={<LeftOutlined />}
            disabled={pageOffset === 0}
            onClick={() => onPageChange(Math.max(0, pageOffset - effectiveLimit))}
          />
          <span style={{ color: 'var(--text-secondary)', fontSize: 13, padding: '0 8px' }}>
            第 {currentPage} / {totalPages} 页
          </span>
          <Button
            size="small"
            icon={<RightOutlined />}
            disabled={pageOffset + effectiveLimit >= total}
            onClick={() => onPageChange(pageOffset + effectiveLimit)}
          />
          <Button
            size="small"
            icon={<DoubleRightOutlined />}
            disabled={pageOffset + effectiveLimit >= total}
            onClick={() => onPageChange(Math.max(0, total - effectiveLimit))}
          />
        </Space>
      )}
      {isAll && (
        <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
          已显示全部
        </span>
      )}
    </div>
  )
}
