import React from 'react';
import { Button, Modal, message } from 'antd';

interface Props {
  userId?: string;
  roleId?: string;
  // If true and no userId/roleId provided, will send confirm flag to allow full purge
  allowFull?: boolean;
}

export default function DeleteSub1({ userId, roleId, allowFull = false }: Props) {
  const handleClick = () => {
    const scope = userId ? (roleId ? `사용자 ${userId}의 역할 ${roleId}` : `사용자 ${userId}`) : '전체(회수된 모든 Role)';
    Modal.confirm({
      title: `${scope} 삭제하시겠습니까?`,
      content: '이 작업은 되돌릴 수 없습니다.',
      okType: 'danger',
      onOk: async () => {
        try {
          const body: any = {};
          if (userId) body.userId = userId;
          if (roleId) body.roleId = roleId;
          if (!userId && !roleId && allowFull) body.confirm = true;

          const res = await fetch('/api/admin/delete-revoked-roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json?.message || '삭제 실패');
          message.success('삭제가 완료되었습니다.');
        } catch (err: any) {
          message.error(err?.message || '삭제 중 오류가 발생했습니다.');
        }
      },
    });
  };

  return (
    <Button danger size="small" onClick={handleClick}>
      회수된 Role 완전삭제
    </Button>
  );
}
