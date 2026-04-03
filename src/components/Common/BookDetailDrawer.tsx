import { useState, useEffect } from 'react'
import { Drawer, Spin, Tag, Typography, Button, message } from 'antd'
import { BookOutlined, LoadingOutlined, FolderOpenOutlined } from '@ant-design/icons'

const { Text } = Typography

// API 地址配置
const API_BASE = window.location.protocol === 'file:'
  ? 'http://127.0.0.1:8765/api'
  : '/api'

// ─── 文件大小格式化 ──────────────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B'
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

// ─── 书籍信息接口 ────────────────────────────────────────────────────────────

export interface BookInfo {
  filePath: string
  title: string | null
  author: string | null
  language?: string | null
  publishYear?: number | null
  subjects?: string[]
  fileSize?: number
  fileName?: string
  relativePath?: string
}

export interface BookDetail {
  filePath: string
  title: string | null
  author: string | null
  language: string | null
  subjects: string[]
  publishYear: number | null
  description: string | null
  coverBase64: string | null
  coverMediaType: string | null
  publisher: string | null
  rights: string | null
  identifier: string | null
  error: string | null
}

// ─── 书籍详情抽屉（公共组件）────────────────────────────────────────────────

interface BookDetailDrawerProps {
  book: BookInfo | null
  open: boolean
  onClose: () => void
}

export function BookDetailDrawer({ book, open, onClose }: BookDetailDrawerProps) {
  const [detail, setDetail] = useState<BookDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // 打开时动态加载详情
  useEffect(() => {
    if (open && book?.filePath) {
      setDetail(null)
      setDetailLoading(true)
      const query = new URLSearchParams({ filePath: book.filePath })
      fetch(`${API_BASE}/library/detail?${query}`)
        .then(res => res.json())
        .then(setDetail)
        .catch(() => message.error('加载书籍详情失败'))
        .finally(() => setDetailLoading(false))
    }
  }, [open, book?.filePath])

  if (!book) return null

  // 优先使用从 EPUB 实时读取的 detail 数据，回退到缓存的 book 数据
  const displayTitle = detail?.title || book.title || book.fileName || '未知书名'
  const displayAuthor = detail?.author || book.author || '未知作者'
  const displaySubjects = detail?.subjects ?? book.subjects ?? []
  const displayPublishYear = detail?.publishYear ?? book.publishYear
  const displayLanguage = detail?.language ?? book.language

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BookOutlined style={{ color: 'var(--accent-color)' }} />
          <span>书籍详情</span>
        </div>
      }
      placement="right"
      width={420}
      open={open}
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* 封面图片 */}
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
            <div style={{ marginTop: 8, color: 'var(--text-tertiary)', fontSize: 13 }}>加载详情中...</div>
          </div>
        ) : detail?.coverBase64 ? (
          <div style={{ textAlign: 'center' }}>
            <img
              src={`data:${detail.coverMediaType || 'image/jpeg'};base64,${detail.coverBase64}`}
              alt="封面"
              style={{
                maxWidth: '100%', maxHeight: 360, borderRadius: 8,
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)', objectFit: 'contain'
              }}
            />
          </div>
        ) : !detailLoading ? (
          <div style={{
            textAlign: 'center', padding: '32px 0', background: 'var(--bg-tertiary)',
            borderRadius: 8, color: 'var(--text-tertiary)', fontSize: 13
          }}>
            <BookOutlined style={{ fontSize: 40, display: 'block', marginBottom: 8, opacity: 0.3 }} />
            无封面图片
          </div>
        ) : null}

        {/* 基本信息 */}
        <div>
          <Text style={{ fontSize: 18, fontWeight: 600, display: 'block', marginBottom: 4 }}>
            {displayTitle}
          </Text>
          <Text type="secondary" style={{ fontSize: 14 }}>
            {displayAuthor}
          </Text>
        </div>

        {/* 分类标签 */}
        {displaySubjects.length > 0 && (
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>分类</Text>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {displaySubjects.map((s, i) => (
                <Tag key={i} color="blue">{s}</Tag>
              ))}
            </div>
          </div>
        )}

        {/* 简介 */}
        {detail?.description && (
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>简介</Text>
            <div
              style={{
                fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)',
                padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: 8,
                maxHeight: 200, overflowY: 'auto'
              }}
              dangerouslySetInnerHTML={{ __html: detail.description }}
            />
          </div>
        )}

        {/* 详细字段 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: '语言', value: displayLanguage },
            { label: '出版年份', value: displayPublishYear },
            { label: '文件大小', value: book.fileSize ? formatFileSize(book.fileSize) : null },
            { label: '文件路径', value: book.relativePath },
            { label: '出版商', value: detail?.publisher },
            { label: '标识符', value: detail?.identifier },
            { label: '版权', value: detail?.rights },
          ].map(({ label, value }) => value && (
            <div key={label} style={{ display: 'flex', gap: 12 }}>
              <Text type="secondary" style={{ fontSize: 13, flexShrink: 0, width: 60 }}>{label}</Text>
              <Text style={{ fontSize: 13, wordBreak: 'break-all' }}>{String(value)}</Text>
            </div>
          ))}
        </div>

        {/* 操作按钮 */}
        <Button
          icon={<FolderOpenOutlined />}
          onClick={() => {
            const dir = book.filePath.substring(0, book.filePath.lastIndexOf('/'))
            window.electronAPI.openPath(dir)
          }}
          style={{ marginTop: 4 }}
        >
          打开所在文件夹
        </Button>
      </div>
    </Drawer>
  )
}