import React from 'react'
import { Empty, Typography } from 'antd'
import { BookOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

export function LibraryPage() {
  return (
    <div className="page-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
      <Empty
        image={<BookOutlined style={{ fontSize: 64, color: '#bfbfbf' }} />}
        description={
          <div style={{ textAlign: 'center' }}>
            <Title level={4}>图书管理</Title>
            <Text type="secondary">
              此功能正在开发中...
            </Text>
            <br />
            <Text type="secondary">
              未来将支持：浏览已下载书籍、编辑元数据、LLM 增强元数据等
            </Text>
          </div>
        }
      />
    </div>
  )
}