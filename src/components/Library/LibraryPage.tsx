import { useState, useEffect, useCallback } from 'react'
import { Card, Empty, Spin, Tag, Segmented, Collapse, Typography, message, Button } from 'antd'
import {
  BookOutlined, FolderOutlined, TagsOutlined, CalendarOutlined,
  ReloadOutlined, FileTextOutlined
} from '@ant-design/icons'
import { useWorkspace } from '../../contexts/WorkspaceContext'
import {
  getLibraryFiles, getLibraryBySubject, getLibraryByYear,
  reindexLibrary,
  EpubMetadata, CategoryGroup
} from '../../services/api'
import { BookDetailDrawer, formatFileSize, BookInfo } from '../Common/BookDetailDrawer'

const { Text } = Typography

type ViewMode = 'all' | 'folder' | 'subject' | 'year'

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

// ─── LibraryPage ────────────────────────────────────────────────────────────

export function LibraryPage() {
  const { workspacePath } = useWorkspace()

  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [loading, setLoading] = useState(false)
  const [reindexing, setReindexing] = useState(false)
  const [allBooks, setAllBooks] = useState<EpubMetadata[]>([])
  const [fileTree, setFileTree] = useState<Record<string, any>>({})
  const [categories, setCategories] = useState<CategoryGroup[]>([])
  const [selectedBook, setSelectedBook] = useState<BookInfo | null>(null)
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
