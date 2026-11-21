import { Icon } from '../icons';
import CompanySwitcher from '../CompanySwitcher';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useStore } from '../store';
import { Card, Header, s } from '../components';
import { colors } from '../theme';
import { findIssues } from '../utils';
import { L } from '../i18n';

export default function MoreScreen({ nav }) {
  const { reports, receipts } = useStore();
  const issues = findIssues(receipts).filter((i) => i.type !== 'no_image').length;
  const items = [
    { icon: 'sparkles', title: L('Assistant', 'AI 助手'), text: L('Ask AI to find, tag, categorise and check your receipts', '让 AI 帮你查找、标记、分类和检查收据'), go: 'agent' },
    { icon: 'file-text', title: L('Expense reports', '报销报告'), text: L(`Professional PDF reports in one tap · ${reports.length} saved`, `一键生成专业 PDF 报告 · 已保存 ${reports.length} 份`), go: 'reports' },
    { icon: 'download', title: L('Export data', '导出数据'), text: L('CSV, PDF, Excel or ZIP — your way', 'CSV、PDF、Excel 或 ZIP，随你选择'), go: 'export' },
    { icon: 'calculator', title: L('Prepare for accounting', '准备会计资料'), text: issues ? L(`${issues} item(s) to tidy, then hand off to your accountant`, `有 ${issues} 项待整理，整理后交给会计师`) : L('Clean records ready for your accountant', '记录已整理好，可交给会计师'), go: 'accounting' },
    { icon: 'settings', title: L('Settings', '设置'), text: L('Companies, currency, categories, Google Drive, AI key, language', '公司、货币、类别、Google 云端硬盘、AI 密钥、语言'), go: 'settings' },
  ];
  return (
    <ScrollView>
      <Header title={L('More', '更多')} />
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        <Card>
          <Text style={[s.sub, { marginBottom: 8 }]}>{L('Working in company', '当前公司')}</Text>
          <CompanySwitcher onManage={() => nav.push('settings')} />
        </Card>
        {items.map((i) => (
          <Card key={i.go} onPress={() => nav.push(i.go)} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.accent + '26', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}><Icon name={i.icon} size={22} color={colors.accentInk} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.h2}>{i.title}</Text>
              <Text style={[s.sub, { marginTop: 2 }]}>{i.text}</Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors.faint} />
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}
