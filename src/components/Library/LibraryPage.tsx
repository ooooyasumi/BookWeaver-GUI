import { useState, useEffect, useCallback } from 'react'
import { Card, Empty, Spin, Tag, Segmented, Collapse, Typography, message, Button, Drawer } from 'antd'
import {
  BookOutlined, FolderOutlined, TagsOutlined, CalendarOutlined,
  ReloadOutlined, FileTextOutlined, FolderOpenOutlined, LoadingOutlined
} from '@ant-design/icons'
import { useWorkspace } from '../../contexts/WorkspaceContext'
import {
  getLibraryFiles, getLibraryBySubject, getLibraryByYear,
  getBookDetail, reindexLibrary,
  EpubMetadata, EpubDetail, CategoryGroup
} from '../../services/api'

const { Text } = Typography

type ViewMode = 'all' | 'folder' | 'subject' | 'year'

// ─── 文件大小格式化 ──────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B'
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

// ─── 书籍列表项 ─────────────────────────────────────────────────────────────

function BookItem({ book, onClick }: { book: EpubMetadata; onClick: () => void }) {
  return (
    <div
      className="book-item"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', marginBottom: 10, cursor: 'pointer'
      }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
        <FileTextOutlined style={{ fontSize: 20, color: 'var(--accent-color)', marginRight: 14, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 500, fontSize: 15, color: 'var(--text-primary)', marginBottom: 2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          }}>
            {book.title || book.fileName}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {book.author || '未知作者'}
            {book.publishYear && <span style={{ marginLeft: 8, color: 'var(--text-tertiary)' }}>({book.publishYear})</span>}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 12 }}>
        {book.subjects && book.subjects.length > 0 && (
          <Tag style={{ margin: 0, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {book.subjects[0]}
          </Tag>
        )}
        {book.language && (
          <Tag color={book.language === 'en' ? 'blue' : 'green'} style={{ margin: 0 }}>
            {book.language}
          </Tag>
        )}
        <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {formatFileSize(book.fileSize)}
        </Text>
      </div>
    </div>
  )
}

// ─── 书籍详情抽屉 ───────────────────────────────────────────────────────────

function BookDetailDrawer({ book, open, onClose }: {
  book: EpubMetadata | null
  open: boolean
  onClose: () => void
}) {
  const [detail, setDetail] = useState<EpubDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // 打开时动态加载详情
  useEffect(() => {
    if (open && book?.filePath) {
      setDetail(null)
      setDetailLoading(true)
      getBookDetail(book.filePath)
        .then(setDetail)
        .catch(() => message.error('加载书籍详情失败'))
        .finally(() => setDetailLoading(false))
    }
  }, [open, book?.filePath])

  if (!book) return null

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
            {book.title || book.fileName}
          </Text>
          <Text type="secondary" style={{ fontSize: 14 }}>
            {book.author || '未知作者'}
          </Text>
        </div>

        {/* 分类标签 */}
        {book.subjects && book.subjects.length > 0 && (
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>分类</Text>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {book.subjects.map((s, i) => (
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
            { label: '语言', value: book.language },
            { label: '出版年份', value: book.publishYear },
            { label: '文件大小', value: formatFileSize(book.fileSize) },
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

// ─── LibraryPage ────────────────────────────────────────────────────────────

export function LibraryPage() {
  const { workspacePath } = useWorkspace()

  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [loading, setLoading] = useState(false)
  const [reindexing, setReindexing] = useState(false)
  const [allBooks, setAllBooks] = useState<EpubMetadata[]>([])
  const [fileTree, setFileTree] = useState<Record<string, any>>({})
  const [categories, setCategories] = useState<CategoryGroup[]>([])
  const [selectedBook, setSelectedBook] = useState<EpubMetadata | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // ── 加载数据 ────────────────────────────────────────────────────────────

  const loadAllFiles = useCallback(async () => {
    if (!workspacePath) return
    setLoading(true)
    try {
      const data = await getLibraryFiles(workspacePath)
      setAllBooks(data.files)
      setFileTree(data.tree)
    } catch (e) {
      message.error('加载图书列表失败')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [workspacePath])

  const loadBySubject = useCallback(async () => {
    if (!workspacePath) return
    setLoading(true)
    try {
      const data = await getLibraryBySubject(workspacePath)
      setCategories(data.categories)
    } catch (e) {
      message.error('加载分类失败')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [workspacePath])

  const loadByYear = useCallback(async () => {
    if (!workspacePath) return
    setLoading(true)
    try {
      const data = await getLibraryByYear(workspacePath)
      setCategories(data.categories)
    } catch (e) {
      message.error('加载年份分类失败')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [workspacePath])

  const loadCurrentView = useCallback(() => {
    switch (viewMode) {
      case 'all':
      case 'folder':
        loadAllFiles()
        break
      case 'subject':
        loadBySubject()
        break
      case 'year':
        loadByYear()
        break
    }
  }, [viewMode, loadAllFiles, loadBySubject, loadByYear])

  useEffect(() => {
    loadCurrentView()
  }, [loadCurrentView])

  // ── 刷新/重建索引 ─────────────────────────────────────────────────────

  const handleReindex = async () => {
    if (!workspacePath) return
    setReindexing(true)
    try {
      const result = await reindexLibrary(workspacePath)
      if (result.success) {
        message.success(`索引重建完成，共 ${result.total} 本书`)
        loadCurrentView()
      } else {
        message.error(result.error || '索引重建失败')
      }
    } catch (e) {
      message.error('索引重建失败')
      console.error(e)
    } finally {
      setReindexing(false)
    }
  }

  // ── 点击书籍 ───────────────────────────────────────────────────────────

  const handleBookClick = (book: EpubMetadata) => {
    setSelectedBook(book)
    setDrawerOpen(true)
  }

  // ── 渲染：全部列表 ─────────────────────────────────────────────────────

  const renderAllView = () => {
    if (allBooks.length === 0) {
      return (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <Empty description="工作区中暂无 EPUB 文件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      )
    }

    return (
      <div>
        {allBooks.map((book, i) => (
          <BookItem key={book.filePath || i} book={book} onClick={() => handleBookClick(book)} />
        ))}
      </div>
    )
  }

  // ── 渲染：文件夹视图 ───────────────────────────────────────────────────

  const renderFolderNode = (node: Record<string, any>): React.ReactNode => {
    const children = node.children || {}
    const entries = Object.entries(children)

    const folders = entries.filter(([, v]: [string, any]) => v.type === 'folder')
    const files = entries.filter(([, v]: [string, any]) => v.type === 'file')

    return (
      <>
        {folders.map(([key, folder]: [string, any]) => {
          const countFiles = (n: any): number => {
            if (n.type === 'file') return 1
            return Object.values(n.children || {}).reduce((acc: number, c: any) => acc + countFiles(c), 0) as number
          }
          const fileCount = countFiles(folder)

          return (
            <Collapse
              key={key}
              bordered={false}
              style={{ background: 'transparent', marginBottom: 8 }}
              items={[{
                key,
                label: (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FolderOutlined style={{ color: 'var(--accent-color)' }} />
                    <Text strong>{folder.name}</Text>
                    <Tag>{fileCount} 本</Tag>
                  </div>
                ),
                children: renderFolderNode(folder),
                style: {
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 12,
                  marginBottom: 8,
                }
              }]}
            />
          )
        })}
        {files.map(([key, file]: [string, any]) => (
          <BookItem key={key} book={file.data} onClick={() => handleBookClick(file.data)} />
        ))}
      </>
    )
  }

  const renderFolderView = () => {
    if (allBooks.length === 0) {
      return (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <Empty description="工作区中暂无 EPUB 文件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      )
    }
    return renderFolderNode(fileTree)
  }

  // ── 渲染：分类/年份视图 ────────────────────────────────────────────────

  const renderCategoryView = () => {
    if (categories.length === 0) {
      return (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      )
    }

    return (
      <Collapse
        accordion
        bordered={false}
        style={{ background: 'transparent' }}
        items={categories.map(cat => ({
          key: cat.name,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {viewMode === 'subject'
                ? <TagsOutlined style={{ color: 'var(--accent-color)' }} />
                : <CalendarOutlined style={{ color: 'var(--accent-color)' }} />
              }
              <Text strong>{cat.name}</Text>
              <Tag>{cat.count} 本</Tag>
            </div>
          ),
          children: (
            <div>
              {cat.books.map((book, i) => (
                <BookItem key={book.filePath || i} book={book} onClick={() => handleBookClick(book)} />
              ))}
            </div>
          ),
          style: {
            marginBottom: 12,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
          }
        }))}
      />
    )
  }

  // ── 主渲染 ─────────────────────────────────────────────────────────────

  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ padding: 80, textAlign: 'center' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: 'var(--text-tertiary)' }}>扫描工作区文件中...</div>
        </div>
      )
    }

    switch (viewMode) {
      case 'all': return renderAllView()
      case 'folder': return renderFolderView()
      case 'subject':
      case 'year':
        return renderCategoryView()
    }
  }

  return (
    <div>
      {/* 工具栏 */}
      <Card className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Segmented
              value={viewMode}
              onChange={(val) => setViewMode(val as ViewMode)}
              options={[
                { label: '全部', value: 'all', icon: <BookOutlined /> },
                { label: '文件夹', value: 'folder', icon: <FolderOutlined /> },
                { label: '分类', value: 'subject', icon: <TagsOutlined /> },
                { label: '年份', value: 'year', icon: <CalendarOutlined /> },
              ]}
              size="large"
            />
            <Tag color="blue" style={{ marginLeft: 8 }}>
              {allBooks.length} 本
            </Tag>
          </div>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleReindex}
            loading={reindexing}
          >
            重建索引
          </Button>
        </div>
      </Card>

      {/* 内容区 */}
      {renderContent()}

      {/* 书籍详情抽屉 */}
      <BookDetailDrawer
        book={selectedBook}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  )
}
